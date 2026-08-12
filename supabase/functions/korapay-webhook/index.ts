import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const korapayWebhookSecret = Deno.env.get('KORAPAY_WEBHOOK_SECRET')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface KoraPayWebhookPayload {
    event: string
    data: {
        reference: string
        amount: number
        currency: string
        status: string
        payment_method?: string
        paid_at?: string
        customer?: {
            name: string
            email: string
            phone?: string
        }
        metadata?: Record<string, any>
        fee?: number
        narration?: string
    }
}

async function verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
): Promise<boolean> {
    try {
        const encoder = new TextEncoder()
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-512' },
            false,
            ['sign']
        )

        const expectedSignature = await crypto.subtle.sign(
            'HMAC',
            key,
            encoder.encode(payload)
        )

        const expectedHex = Array.from(new Uint8Array(expectedSignature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')

        return signature === expectedHex
    } catch (error) {
        console.error('Signature verification error:', error)
        return false
    }
}

async function logWebhook(
    webhookType: string,
    reference: string,
    headers: Record<string, string>,
    payload: any,
    signature: string,
    processed: boolean = false,
    processingResult?: any,
    errorMessage?: string
) {
    try {
        await supabase
            .from('payment_webhook_logs')
            .insert({
                webhook_type: webhookType,
                korapay_reference: reference,
                headers,
                payload,
                signature,
                processed,
                processing_result: processingResult,
                error_message: errorMessage,
                processed_at: processed ? new Date().toISOString() : null,
            })
    } catch (error) {
        console.error('Error logging webhook:', error)
    }
}

async function handlePaymentWebhook(webhookData: KoraPayWebhookPayload) {
    const { event, data } = webhookData
    const reference = data.reference

    console.log(`Processing ${event} webhook for reference: ${reference}`)

    try {
        // Get payment transaction
        const { data: paymentTransaction, error: fetchError } = await supabase
            .from('payment_transactions')
            .select('*')
            .eq('korapay_reference', reference)
            .single()

        if (fetchError || !paymentTransaction) {
            throw new Error(`Payment transaction not found for reference: ${reference}`)
        }

        let updateData: any = {
            webhook_data: webhookData,
            updated_at: new Date().toISOString(),
        }

        switch (event) {
            case 'charge.success':
            case 'payment.success':
                updateData = {
                    ...updateData,
                    status: 'success',
                    payment_status: 'paid',
                    payment_method: data.payment_method || 'unknown',
                    paid_at: data.paid_at ? new Date(data.paid_at).toISOString() : new Date().toISOString(),
                }

                // Update payment transaction
                await supabase
                    .from('payment_transactions')
                    .update(updateData)
                    .eq('id', paymentTransaction.id)

                // Update order status
                await supabase
                    .from('orders')
                    .update({
                        status: 'accepted',
                        payment_status: 'paid',
                    })
                    .eq('id', paymentTransaction.order_id)

                // Create escrow transaction
                await createEscrowTransaction(paymentTransaction, data)
                break

            case 'charge.failed':
            case 'payment.failed':
                updateData = {
                    ...updateData,
                    status: 'failed',
                    payment_status: 'failed',
                    failure_reason: `Payment failed via webhook: ${event}`,
                }

                // Update payment transaction
                await supabase
                    .from('payment_transactions')
                    .update(updateData)
                    .eq('id', paymentTransaction.id)

                // Update order status
                await supabase
                    .from('orders')
                    .update({
                        status: 'cancelled',
                        payment_status: 'failed',
                    })
                    .eq('id', paymentTransaction.order_id)
                break

            case 'transfer.success':
                // Handle successful vendor payout
                await handleTransferSuccess(data)
                break

            case 'transfer.failed':
                // Handle failed vendor payout
                await handleTransferFailed(data)
                break

            case 'refund.success':
                // Handle successful refund
                await handleRefundSuccess(data)
                break

            case 'refund.failed':
                // Handle failed refund
                await handleRefundFailed(data)
                break

            default:
                console.log(`Unhandled webhook event: ${event}`)
        }

        return { success: true, message: `Webhook ${event} processed successfully` }
    } catch (error) {
        console.error(`Error processing ${event} webhook:`, error)
        throw error
    }
}

async function createEscrowTransaction(paymentTransaction: any, paymentData: any) {
    try {
        const platformFeePercentage = 0.05 // 5% platform fee
        const amount = paymentData.amount / 100 // Convert from kobo to naira
        const platformFee = amount * platformFeePercentage
        const vendorAmount = amount - platformFee
        const escrowHoldHours = 24 // 24 hours hold period

        await supabase
            .from('escrow_transactions')
            .insert({
                payment_transaction_id: paymentTransaction.id,
                order_id: paymentTransaction.order_id,
                vendor_id: paymentTransaction.vendor_id,
                amount,
                currency: paymentData.currency,
                platform_fee: platformFee,
                vendor_amount: vendorAmount,
                status: 'held',
                hold_until: new Date(Date.now() + escrowHoldHours * 60 * 60 * 1000).toISOString(),
                auto_release: true,
            })

        console.log(`Escrow transaction created for payment: ${paymentTransaction.id}`)
    } catch (error) {
        console.error('Error creating escrow transaction:', error)
    }
}

async function handleTransferSuccess(data: any) {
    try {
        const { data: payout, error } = await supabase
            .from('vendor_payouts')
            .update({
                status: 'success',
                korapay_transfer_id: data.reference,
                processed_at: new Date().toISOString(),
                korapay_response: data,
            })
            .eq('korapay_transfer_reference', data.reference)
            .select()
            .single()

        if (error) {
            throw new Error(`Payout not found for reference: ${data.reference}`)
        }

        console.log(`Payout successful for reference: ${data.reference}`)
    } catch (error) {
        console.error('Error handling transfer success:', error)
    }
}

async function handleTransferFailed(data: any) {
    try {
        await supabase
            .from('vendor_payouts')
            .update({
                status: 'failed',
                failure_reason: 'Transfer failed via webhook',
                korapay_response: data,
            })
            .eq('korapay_transfer_reference', data.reference)

        console.log(`Payout failed for reference: ${data.reference}`)
    } catch (error) {
        console.error('Error handling transfer failure:', error)
    }
}

async function handleRefundSuccess(data: any) {
    try {
        const { data: refund, error } = await supabase
            .from('refund_transactions')
            .update({
                status: 'success',
                korapay_refund_id: data.reference,
                processed_at: new Date().toISOString(),
                korapay_response: data,
            })
            .eq('korapay_refund_reference', data.reference)
            .select()
            .single()

        if (error) {
            throw new Error(`Refund not found for reference: ${data.reference}`)
        }

        // Update payment transaction status
        await supabase
            .from('payment_transactions')
            .update({
                payment_status: refund.refund_type === 'full' ? 'refunded' : 'partially_refunded',
            })
            .eq('id', refund.payment_transaction_id)

        console.log(`Refund successful for reference: ${data.reference}`)
    } catch (error) {
        console.error('Error handling refund success:', error)
    }
}

async function handleRefundFailed(data: any) {
    try {
        await supabase
            .from('refund_transactions')
            .update({
                status: 'failed',
                korapay_response: data,
            })
            .eq('korapay_refund_reference', data.reference)

        console.log(`Refund failed for reference: ${data.reference}`)
    } catch (error) {
        console.error('Error handling refund failure:', error)
    }
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const signature = req.headers.get('x-korapay-signature') || ''
        const payloadText = await req.text()

        // Verify webhook signature
        if (!await verifyWebhookSignature(payloadText, signature, korapayWebhookSecret)) {
            console.error('Invalid webhook signature')
            return new Response(
                JSON.stringify({ error: 'Invalid signature' }),
                {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        const webhookData: KoraPayWebhookPayload = JSON.parse(payloadText)
        const headers = Object.fromEntries(req.headers.entries())

        // Log webhook
        await logWebhook(
            webhookData.event,
            webhookData.data.reference,
            headers,
            webhookData,
            signature
        )

        // Process webhook
        const result = await handlePaymentWebhook(webhookData)

        // Update webhook log with success
        await logWebhook(
            webhookData.event,
            webhookData.data.reference,
            headers,
            webhookData,
            signature,
            true,
            result
        )

        return new Response(
            JSON.stringify(result),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    } catch (error) {
        console.error('Webhook processing error:', error)

        // Try to log error if we have webhook data
        try {
            const webhookData = JSON.parse(await req.text())
            await logWebhook(
                webhookData.event,
                webhookData.data.reference,
                Object.fromEntries(req.headers.entries()),
                webhookData,
                req.headers.get('x-korapay-signature') || '',
                false,
                null,
                error.message
            )
        } catch (logError) {
            console.error('Error logging webhook failure:', logError)
        }

        return new Response(
            JSON.stringify({
                error: 'Webhook processing failed',
                message: error.message
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})
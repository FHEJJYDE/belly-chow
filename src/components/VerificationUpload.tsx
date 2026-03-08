import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, CheckCircle, Clock, XCircle, ShieldCheck } from 'lucide-react';

interface Verification {
  id: string;
  document_url: string;
  document_type: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  created_at: string;
}

const statusConfig = {
  pending: { icon: Clock, label: 'Under Review', color: 'bg-yellow-500/10 text-yellow-700' },
  approved: { icon: CheckCircle, label: 'Verified', color: 'bg-green-500/10 text-green-700' },
  rejected: { icon: XCircle, label: 'Rejected', color: 'bg-red-500/10 text-red-700' },
};

const VerificationUpload = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [verification, setVerification] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('national_id');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('verifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setVerification(data[0] as unknown as Verification);
        setLoading(false);
      });
  }, [user]);

  const handleUpload = async () => {
    if (!user || !file) return;
    setUploading(true);

    const ext = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('verification-docs')
      .upload(path, file);

    if (uploadError) {
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('verification-docs').getPublicUrl(path);

    const { error: insertError } = await supabase.from('verifications').insert({
      user_id: user.id,
      document_url: path,
      document_type: docType,
    } as any);

    setUploading(false);

    if (insertError) {
      toast({ title: 'Error', description: insertError.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'ID submitted for verification ✅' });
    setVerification({
      id: '',
      document_url: path,
      document_type: docType,
      status: 'pending',
      admin_notes: null,
      created_at: new Date().toISOString(),
    });
    setFile(null);
  };

  if (loading) return null;

  // Already verified
  if (verification?.status === 'approved') {
    return (
      <Card className="border-green-200 bg-green-50/50">
        <CardContent className="flex items-center gap-3 p-4">
          <ShieldCheck className="h-6 w-6 text-green-600" />
          <div>
            <p className="font-medium text-green-700">Identity Verified</p>
            <p className="text-sm text-green-600">Your account has been verified.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Pending review
  if (verification?.status === 'pending') {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <Clock className="h-6 w-6 text-yellow-600" />
          <div>
            <p className="font-medium">Verification Under Review</p>
            <p className="text-sm text-muted-foreground">Your ID is being reviewed. This usually takes a few hours.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5" /> Verify Your Identity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {verification?.status === 'rejected' && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <p className="text-sm font-medium text-destructive">Previous submission was rejected</p>
            {verification.admin_notes && <p className="text-sm text-muted-foreground">{verification.admin_notes}</p>}
          </div>
        )}

        <div>
          <Label>Document Type</Label>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="national_id">National ID (NIN)</SelectItem>
              <SelectItem value="student_id">Student ID Card</SelectItem>
              <SelectItem value="drivers_license">Driver's License</SelectItem>
              <SelectItem value="passport">International Passport</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Upload ID Photo</Label>
          <Input
            type="file"
            accept="image/*,.pdf"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="mt-1"
          />
          <p className="mt-1 text-xs text-muted-foreground">Clear photo of your ID. Max 5MB. JPG, PNG or PDF.</p>
        </div>

        <Button onClick={handleUpload} disabled={!file || uploading} className="w-full gap-2">
          <Upload className="h-4 w-4" />
          {uploading ? 'Uploading...' : 'Submit for Verification'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default VerificationUpload;

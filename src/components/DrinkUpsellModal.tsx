import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GlassWater, Plus, Minus, X, Sparkles } from 'lucide-react';

interface Drink {
  id: string;
  name: string;
  price: number;
  image_url: string;
}

export interface SelectedDrink {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CustomDrinkRequest {
  name: string;
  max_budget: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (drinks: SelectedDrink[], customRequest: CustomDrinkRequest | null) => void;
}

const DrinkUpsellModal = ({ open, onClose, onConfirm }: Props) => {
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customBudget, setCustomBudget] = useState('');

  useEffect(() => {
    if (!open) return;
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase.from('drinks' as any).select('*').eq('is_available', true).order('name');
      setDrinks((data as any) || []);
      setLoading(false);
    };
    fetch();
    setSelected({});
    setShowCustom(false);
    setCustomName('');
    setCustomBudget('');
  }, [open]);

  const updateQty = (id: string, delta: number) => {
    setSelected(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) { const { [id]: _, ...rest } = prev; return rest; }
      return { ...prev, [id]: next };
    });
  };

  const drinkTotal = Object.entries(selected).reduce((sum, [id, qty]) => {
    const drink = drinks.find(d => d.id === id);
    return sum + (drink ? drink.price * qty : 0);
  }, 0);

  const selectedCount = Object.values(selected).reduce((s, q) => s + q, 0);

  const handleConfirm = () => {
    const selectedDrinks: SelectedDrink[] = Object.entries(selected).map(([id, quantity]) => {
      const drink = drinks.find(d => d.id === id)!;
      return { id, name: drink.name, price: drink.price, quantity };
    });
    const customReq = showCustom && customName.trim() ? { name: customName.trim(), max_budget: parseFloat(customBudget) || 0 } : null;
    onConfirm(selectedDrinks, customReq);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Need a drink to cool down? 🧊
          </DialogTitle>
          <DialogDescription>Add a refreshing drink to your order</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : !showCustom ? (
            <>
              {drinks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No drinks available right now</p>
              ) : (
                drinks.map(drink => {
                  const qty = selected[drink.id] || 0;
                  return (
                    <div key={drink.id} className="flex items-center gap-3 rounded-lg border p-3">
                      {drink.image_url ? (
                        <img src={drink.image_url} alt={drink.name} className="h-11 w-11 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="h-11 w-11 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <GlassWater className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{drink.name}</p>
                        <p className="text-xs text-muted-foreground">₦{Number(drink.price).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {qty > 0 ? (
                          <>
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(drink.id, -1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-5 text-center text-sm font-medium">{qty}</span>
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(drink.id, 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => updateQty(drink.id, 1)}>
                            Add
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              <button
                onClick={() => setShowCustom(true)}
                className="w-full rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors text-center"
              >
                Don't like these? Request a custom drink →
              </button>
            </>
          ) : (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Tell us what drink you'd like and your max budget — the vendor will try to get it for you.</p>
              <div>
                <Label className="text-sm">Drink name / description</Label>
                <Input placeholder="e.g. Chapman, Zobo, Fresh juice…" value={customName} onChange={e => setCustomName(e.target.value)} />
              </div>
              <div>
                <Label className="text-sm">Max budget (₦)</Label>
                <Input type="number" placeholder="e.g. 500" value={customBudget} onChange={e => setCustomBudget(e.target.value)} />
              </div>
              <button
                onClick={() => setShowCustom(false)}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                ← Back to drink menu
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t pt-4 space-y-2">
          {(selectedCount > 0 || (showCustom && customName.trim())) && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {selectedCount > 0 ? `${selectedCount} drink${selectedCount > 1 ? 's' : ''}` : 'Custom request'}
              </span>
              {drinkTotal > 0 && <span className="font-medium">+₦{drinkTotal.toLocaleString()}</span>}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              No thanks
            </Button>
            <Button
              className="flex-1"
              onClick={handleConfirm}
              disabled={selectedCount === 0 && !(showCustom && customName.trim())}
            >
              {selectedCount > 0 || (showCustom && customName.trim()) ? 'Add to order' : 'Skip'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DrinkUpsellModal;

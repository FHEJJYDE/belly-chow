import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, Store } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface VendorLogoUploadProps {
  vendorId: string;
  userId: string;
  currentUrl: string | null;
  vendorName: string;
  onUploaded: (url: string) => void;
}

const VendorLogoUpload = ({ vendorId, userId, currentUrl, vendorName, onUploaded }: VendorLogoUploadProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 3MB', variant: 'destructive' });
      return;
    }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${userId}/logo.${ext}`;

    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: updateErr } = await supabase
      .from('vendors')
      .update({ logo_url: publicUrl })
      .eq('id', vendorId);

    if (updateErr) {
      toast({ title: 'Error saving', description: updateErr.message, variant: 'destructive' });
    } else {
      onUploaded(publicUrl);
      toast({ title: 'Restaurant logo updated!' });
    }
    setUploading(false);
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Restaurant Logo / Banner</Label>
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar className="h-20 w-20 rounded-xl border-2 border-border">
            <AvatarImage src={currentUrl || undefined} alt={vendorName} className="object-cover" />
            <AvatarFallback className="rounded-xl"><Store className="h-8 w-8 text-muted-foreground" /></AvatarFallback>
          </Avatar>
          <Button
            variant="secondary"
            size="icon"
            className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full shadow-md"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">
          <p>Upload your restaurant's logo</p>
          <p className="text-xs">Max 3MB • JPG, PNG</p>
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={upload} />
    </div>
  );
};

export default VendorLogoUpload;

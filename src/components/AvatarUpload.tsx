import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Camera, Loader2 } from 'lucide-react';

interface AvatarUploadProps {
  userId: string;
  currentUrl: string | null;
  fullName: string;
  onUploaded: (url: string) => void;
}

const AvatarUpload = ({ userId, currentUrl, fullName, onUploaded }: AvatarUploadProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 2MB', variant: 'destructive' });
      return;
    }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${userId}/avatar.${ext}`;

    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('user_id', userId);

    if (updateErr) {
      toast({ title: 'Error saving', description: updateErr.message, variant: 'destructive' });
    } else {
      onUploaded(publicUrl);
      toast({ title: 'Profile picture updated!' });
    }
    setUploading(false);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <Avatar className="h-20 w-20 border-2 border-border">
          <AvatarImage src={currentUrl || undefined} alt={fullName} />
          <AvatarFallback className="text-lg font-semibold">{initials || '?'}</AvatarFallback>
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
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={upload} />
      <p className="text-xs text-muted-foreground">Tap to change photo</p>
    </div>
  );
};

export default AvatarUpload;

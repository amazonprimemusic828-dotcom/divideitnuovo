import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/components/AuthContext";
import { supabase } from "@/lib/supabaseClient";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Bell, Shield, Save, MapPin, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import UserAvatar from "@/components/UserAvatar";
import AvatarSelector from "@/components/settings/AvatarSelector";
import NotificationPreferences from "@/components/settings/NotificationPreferences";
import SecuritySettings from "@/components/settings/SecuritySettings";
import DeleteAccountSection from "@/components/settings/DeleteAccountSection";

import TrustCenter from "@/components/trust/TrustCenter";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useTrustScore } from "@/hooks/useTrustScore";

export default function Settings() {
  const { t } = useTranslation();
  const { user, updateUserProfile } = useAuth();
  const { profile, update: updateProfile, loading: profileLoading } = useUserProfile();
  const { score: trustScore } = useTrustScore();
  const [searchParams, setSearchParams] = useSearchParams();

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
  });
  const [address, setAddress] = useState({
    address_line: "",
    address_city: "",
    address_zip: "",
    address_country: "",
  });
  const [loading, setLoading] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);

  const tab = searchParams.get("tab") || "profile";
  const avatarPreviewUrl = useRef<string | null>(null);
  useEffect(() => () => {
    if (avatarPreviewUrl.current) URL.revokeObjectURL(avatarPreviewUrl.current);
  }, []);
  const handleGeneratedAvatar = (file: File) => {
    const url = URL.createObjectURL(file);
    if (avatarPreviewUrl.current) URL.revokeObjectURL(avatarPreviewUrl.current);
    avatarPreviewUrl.current = url;
    setCurrentAvatar(url);
    toast.info("Avatar AI impostato solo in memoria. Nessun salvataggio online.");
  };

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || "",
        email: user.email || "",
        phone: user.phone || "",
      });
      setCurrentAvatar(user.avatar_url || null);
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      const p = profile as any;
      setAddress({
        address_line: p.address_line || "",
        address_city: p.address_city || "",
        address_zip: p.address_zip || "",
        address_country: p.address_country || "",
      });
    }
  }, [profile]);

  useEffect(() => {
    if (searchParams.get("identity") === "done") {
      toast.success("Verifica identità inviata. Riceverai l'esito a breve.");
    }
  }, [searchParams]);

  const handleAvatarUpload = async (file: File): Promise<string | null> => {
    if (!user?.uid) return null;
    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.uid}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Errore caricamento immagine');
        return null;
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      toast.success('Avatar caricato!');
      return data.publicUrl;
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error('Errore caricamento avatar');
      return null;
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleAvatarSelect = async (avatarUrl: string | null) => {
    const previous = currentAvatar;
    setCurrentAvatar(avatarUrl);
    try {
      await updateUserProfile({ avatar_url: avatarUrl });
      toast.success(avatarUrl ? 'Avatar salvato!' : 'Avatar rimosso');
    } catch (e: any) {
      setCurrentAvatar(previous);
      toast.error("Errore nel salvataggio dell'avatar");
      throw e;
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateUserProfile({
        full_name: formData.full_name,
        phone: formData.phone,
      });
      if (profile) {
        await updateProfile({ user_email: formData.email } as any);
      }
      toast.success("Impostazioni salvate!");
    } catch (error) {
      toast.error("Errore nel salvataggio");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAddress = async () => {
    setSavingAddress(true);
    try {
      await updateProfile(address as any);
      toast.success("Indirizzo salvato");
    } catch {
      toast.error("Errore nel salvataggio dell'indirizzo");
    } finally {
      setSavingAddress(false);
    }
  };

  const displayName = user?.full_name || user?.email?.split('@')[0] || 'Utente';
  const displayEmail = user?.email || '';

  const tabClass =
    "rounded-xl py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary font-semibold text-sm transition-all";

  return (
    <div className="p-4 lg:p-10 pb-24 lg:pb-10">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <span className="eyebrow">Account</span>
          <h1 className="display-lg mt-4 text-foreground">{t('settings')}</h1>
          <p className="mt-3 text-muted-foreground leading-relaxed">Gestisci profilo, affidabilità, notifiche e sicurezza</p>
        </div>

        <Card className="panel mb-8 border-primary/20 bg-primary-soft/25 p-6">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <UserAvatar
              userEmail={displayEmail}
              userName={displayName}
              avatarUrl={currentAvatar}
              size="xl"
              trustScore={trustScore}
            />
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-2xl font-extrabold tracking-tight text-foreground">{displayName}</h2>
              <p className="text-muted-foreground mb-3">{displayEmail}</p>
              <AvatarSelector
                onGeneratedAvatar={handleGeneratedAvatar}
                currentAvatar={currentAvatar}
                onAvatarSelect={handleAvatarSelect}
                onFileUpload={handleAvatarUpload}
                isUploading={isUploadingAvatar}
              />
            </div>
          </div>
        </Card>

        <Tabs
          value={tab}
          onValueChange={(v) => setSearchParams(v === "profile" ? {} : { tab: v })}
          className="space-y-6"
        >
          <TabsList className="grid grid-cols-4 gap-2 h-auto p-2 bg-muted/50 rounded-2xl">
            <TabsTrigger value="profile" className={tabClass}>
              <User className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('profile')}</span>
            </TabsTrigger>
            <TabsTrigger value="trust" className={tabClass}>
              <Sparkles className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Affidabilità</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className={tabClass}>
              <Bell className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('notifications')}</span>
            </TabsTrigger>
            <TabsTrigger value="security" className={tabClass}>
              <Shield className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Sicurezza</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card className="panel p-6">
              <h3 className="text-xl font-bold text-foreground mb-1">{t('personalInfo')}</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Questi dati sono visibili agli altri membri dei tuoi gruppi.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>{t('name')}</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="mt-2 rounded-xl"
                  />
                </div>

                <div>
                  <Label>{t('email')}</Label>
                  <Input value={formData.email} disabled className="mt-2 rounded-xl bg-muted" />
                  <p className="text-xs text-muted-foreground mt-1">L'email non può essere modificata</p>
                </div>

                <div>
                  <Label>{t('phone')}</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+39 333 123 4567"
                    className="mt-2 rounded-xl"
                  />
                </div>
              </div>

              <Button
                onClick={handleSave}
                disabled={loading}
                className="gradient-divideit text-white rounded-xl mt-6"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {loading ? "Salvataggio..." : t('save')}
              </Button>
            </Card>

            <Card className="panel p-6">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground">Indirizzo</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Completare l'indirizzo aumenta il tuo punteggio di affidabilità (+5 PT).
              </p>

              {profileLoading ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label>Via e numero civico</Label>
                      <Input
                        value={address.address_line}
                        onChange={(e) => setAddress({ ...address, address_line: e.target.value })}
                        placeholder="Via Roma 12"
                        className="mt-2 rounded-xl"
                      />
                    </div>
                    <div>
                      <Label>Città</Label>
                      <Input
                        value={address.address_city}
                        onChange={(e) => setAddress({ ...address, address_city: e.target.value })}
                        placeholder="Milano"
                        className="mt-2 rounded-xl"
                      />
                    </div>
                    <div>
                      <Label>CAP</Label>
                      <Input
                        value={address.address_zip}
                        onChange={(e) => setAddress({ ...address, address_zip: e.target.value })}
                        placeholder="20100"
                        className="mt-2 rounded-xl"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Paese</Label>
                      <Input
                        value={address.address_country}
                        onChange={(e) => setAddress({ ...address, address_country: e.target.value })}
                        placeholder="Italia"
                        className="mt-2 rounded-xl"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleSaveAddress}
                    disabled={savingAddress}
                    variant="outline"
                    className="rounded-xl mt-6"
                  >
                    {savingAddress ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Salva indirizzo
                  </Button>
                </>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="trust">
            <TrustCenter />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationPreferences />
          </TabsContent>

          <TabsContent value="security">
            <div className="space-y-6">
              <SecuritySettings />
              <DeleteAccountSection />
            </div>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}

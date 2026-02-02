import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { auth } from '@/lib/firebase';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, UserPlus, Shield, Users, User, CheckCircle, Lock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { AppRole } from '@/lib/firestore-types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function CreateUser() {
  const { t } = useTranslation();
  const { isAdmin, isLoading: authLoading, user: currentUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdUser, setCreatedUser] = useState<{ email: string; full_name: string; role: string } | null>(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AppRole>('user');
  
  // Password verification state
  const [currentPassword, setCurrentPassword] = useState('');

  const verifyCurrentPassword = async () => {
    if (!currentUser || !currentPassword.trim()) {
      toast({
        title: t('common.error'),
        description: t('security.passwordRequired'),
        variant: 'destructive',
      });
      return;
    }

    setIsVerifyingPassword(true);

    try {
      // Create credential with current user's email and entered password
      const credential = EmailAuthProvider.credential(
        currentUser.email!,
        currentPassword
      );

      // Reauthenticate the user
      await reauthenticateWithCredential(auth.currentUser!, credential);
      
      console.log('Password verification successful for creating admin user');
      toast({
        title: t('security.passwordVerified'),
        description: t('security.canNowActionAdmin', { action: t('common.create').toLowerCase() }),
      });

      // Close password dialog and proceed with user creation
      setIsPasswordDialogOpen(false);
      proceedWithUserCreation();
    } catch (error: any) {
      console.error('Password verification failed:', error);
      toast({
        title: t('security.incorrectPassword'),
        description: t('security.incorrectPasswordMessage'),
        variant: 'destructive',
      });
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const proceedWithUserCreation = async () => {
    setIsSubmitting(true);
    setCreatedUser(null);

    try {
      // Get the current user's ID token
      const idToken = await auth.currentUser?.getIdToken();
      
      if (!idToken) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          role,
          idToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('users.failedToCreateUser'));
      }

      setCreatedUser({
        email: data.user.email,
        full_name: data.user.full_name,
        role: data.user.role,
      });

      toast({
        title: t('users.userCreatedSuccessfully'),
        description: t('users.userAddedAsRole', { name: fullName, role: t(`users.roles.${role}`) }),
      });

      // Reset form
      setEmail('');
      setPassword('');
      setFullName('');
      setRole('user');
      setCurrentPassword('');
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: t('common.error'),
        description: error.message || t('common.operationFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if creating an admin user
    if (role === 'admin') {
      console.log('Creating admin user, requiring password verification');
      setIsPasswordDialogOpen(true);
    } else {
      // For non-admin users, proceed directly
      proceedWithUserCreation();
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Password Verification Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={(open) => {
        setIsPasswordDialogOpen(open);
        if (!open) {
          setCurrentPassword('');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-600" />
              {t('security.adminSecurityVerification')}
            </DialogTitle>
            <DialogDescription>
              {t('security.enterCurrentPasswordCreate')}
              <br />
              <span className="text-xs text-muted-foreground mt-2 block">
                {t('security.securityMeasure')}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 text-amber-800">
                <Shield className="h-4 w-4" />
                <span className="font-medium">{t('security.securityNotice')}</span>
              </div>
              <p className="text-sm text-amber-700 mt-1">
                {t('common.create')} {t('users.roles.admin')}: <strong>{fullName}</strong> ({email})
              </p>
              <p className="text-sm text-red-600 mt-1 font-medium">
                ⚠️ {t('security.adminPrivileges')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentPasswordCreate">{t('security.currentPassword')} *</Label>
              <Input
                id="currentPasswordCreate"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t('security.enterPassword')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    verifyCurrentPassword();
                  }
                }}
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsPasswordDialogOpen(false);
                  setCurrentPassword('');
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button 
                onClick={verifyCurrentPassword} 
                disabled={isVerifyingPassword || !currentPassword.trim()}
                className="gap-2 bg-amber-600 hover:bg-amber-700"
              >
                {isVerifyingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('security.verifyAndCreateAdmin')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-primary/10">
          <UserPlus className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {t('users.createUserAccount')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t('users.addNewMembers')}
          </p>
        </div>
      </div>

      {/* Success Message */}
      {createdUser && (
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div className="text-sm">
                <p className="font-medium text-foreground mb-1">{t('users.userCreatedSuccessfully')}!</p>
                <p className="text-muted-foreground">
                  <strong>{createdUser.full_name}</strong> ({createdUser.email}) {t('common.hasBeen')} {t('common.added').toLowerCase()} {t('common.as').toLowerCase()} {' '}
                  <strong className="capitalize">{t(`users.roles.${createdUser.role}`)}</strong>.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">{t('users.newUserDetails')}</CardTitle>
          <CardDescription>
            {t('users.createLoginCredentials')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="fullName">{t('users.fullName')} *</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('users.userPlaceholder')}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('users.email')} *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('users.emailPlaceholder')}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')} *</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('users.minimumCharacters')}
                minLength={6}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>{t('users.userRole')} *</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{t('users.roleUserViewOnly')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="player">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>{t('users.roles.player')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Lock className="h-3 w-3 text-amber-600" />
                        <Shield className="h-4 w-4" />
                      </div>
                      <span>{t('users.roles.admin')}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {t('users.fullControl')}
                {role === 'admin' && (
                  <span className="block text-amber-600 font-medium mt-1">
                    🔒 {t('security.creatingAdminRequiresPassword')}
                  </span>
                )}
              </p>
            </div>

            <div className="pt-4 border-t border-border">
              <Button 
                type="submit" 
                disabled={isSubmitting} 
                className={`w-full gap-2 ${role === 'admin' ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('users.creating')}
                  </>
                ) : (
                  <>
                    {role === 'admin' ? (
                      <Lock className="h-4 w-4" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    {role === 'admin' ? t('users.createAdminAccount') : t('users.createUserAccount')}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

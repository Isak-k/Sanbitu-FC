import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Loader2,
  Users,
  Edit,
  Trash2,
  Shield,
  User,
  UserCheck,
  Lock,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { AppRole } from '@/lib/firestore-types';
import { cn } from '@/lib/utils';

import { useTranslation } from 'react-i18next';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface UserWithRole {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  created_at: string;
  last_sign_in?: string;
}

export default function ManageUsers() {
  const { t } = useTranslation();
  const { isAdmin, isLoading: authLoading, user: currentUser } = useAuth();

  const roleConfig = {
    admin: {
      label: t('users.roles.admin'),
      icon: Shield,
      color: 'text-red-600',
      bgColor: 'bg-red-500/10',
    },
    player: {
      label: t('users.roles.player'),
      icon: UserCheck,
      color: 'text-blue-600',
      bgColor: 'bg-blue-500/10',
    },
    user: {
      label: t('users.roles.user'),
      icon: User,
      color: 'text-gray-600',
      bgColor: 'bg-gray-500/10',
    },
  };
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AppRole>('user');
  
  // Password verification state
  const [currentPassword, setCurrentPassword] = useState('');
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [pendingAction, setPendingAction] = useState<'edit' | 'delete' | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      // Fetch user roles from Firestore
      const userRolesSnapshot = await getDocs(collection(db, 'user_roles'));
      const usersData: UserWithRole[] = [];
      
      userRolesSnapshot.forEach(doc => {
        const data = doc.data();
        usersData.push({
          id: doc.id,
          email: data.email || 'N/A',
          full_name: data.full_name || 'Unknown User',
          role: data.role,
          created_at: data.created_at,
          last_sign_in: data.last_sign_in,
        });
      });

      // Sort by creation date (newest first)
      usersData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: t('common.error'),
        description: t('users.failedToFetchUsers'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setRole('user');
    setEditingUser(null);
    setCurrentPassword('');
    setPendingAction(null);
  };

  const openEditDialog = (user: UserWithRole) => {
    setEditingUser(user);
    setFullName(user.full_name);
    setEmail(user.email);
    setRole(user.role);
    
    // Check if editing an admin user
    if (user.role === 'admin') {
      console.log('Editing admin user, requiring password verification');
      setPendingAction('edit');
      setIsPasswordDialogOpen(true);
    } else {
      setIsDialogOpen(true);
    }
  };

  const openDeleteDialog = (user: UserWithRole) => {
    setEditingUser(user);
    
    // Check if deleting an admin user
    if (user.role === 'admin') {
      console.log('Deleting admin user, requiring password verification');
      setPendingAction('delete');
      setIsPasswordDialogOpen(true);
    } else {
      // For non-admin users, proceed with normal delete confirmation
      proceedWithDelete(user);
    }
  };

  const verifyCurrentPassword = async () => {
    if (!currentUser || !currentPassword.trim()) {
      toast({
        title: t('common.error'),
        description: t('users.enterPassword'),
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
      
      console.log('Password verification successful for action:', pendingAction);
      toast({
        title: t('users.passwordVerified'),
        description: t('users.canNowActionAdmin', { action: pendingAction === 'edit' ? t('common.edit') : t('common.delete') }),
      });

      // Close password dialog and proceed with the intended action
      setIsPasswordDialogOpen(false);
      
      if (pendingAction === 'edit') {
        setIsDialogOpen(true);
      } else if (pendingAction === 'delete' && editingUser) {
        proceedWithDelete(editingUser);
      }
    } catch (error: any) {
      console.error('Password verification failed:', error);
      toast({
        title: t('users.incorrectPassword'),
        description: t('users.incorrectPasswordDesc'),
        variant: 'destructive',
      });
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    setIsSubmitting(true);

    try {
      // Update user role in Firestore
      await updateDoc(doc(db, 'user_roles', editingUser.id), {
        full_name: fullName.trim(),
        email: email.trim(),
        role,
        updated_at: new Date().toISOString(),
      });

      toast({
        title: t('users.userUpdated'),
        description: t('users.userUpdatedDesc', { name: fullName }),
      });

      setIsDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('users.failedToUpdateUser'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const proceedWithDelete = async (user: UserWithRole) => {
    // Confirmation dialog
    const confirmed = window.confirm(
      t('users.deleteUserConfirmation', {
        name: user.full_name,
        email: user.email,
        role: roleConfig[user.role].label
      })
    );

    if (!confirmed) return;

    try {
      // Get the current admin's ID token for authentication
      const idToken = await auth.currentUser?.getIdToken();
      
      if (!idToken) {
        throw new Error('Not authenticated');
      }

      // Call Supabase function to delete user (this would need to be implemented)
      const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          idToken,
        }),
      });

      if (!response.ok) {
        // If Supabase function doesn't exist, just delete from Firestore
        await deleteDoc(doc(db, 'user_roles', user.id));
      }

      toast({
        title: t('users.userDeleted'),
        description: t('users.userDeletedDesc', { name: user.full_name }),
      });

      fetchUsers();
    } catch (error: any) {
      // Fallback: delete from Firestore only
      try {
        await deleteDoc(doc(db, 'user_roles', user.id));
        
        toast({
          title: t('users.userDeleted'),
          description: t('users.userDeletedFallbackDesc', { name: user.full_name }),
        });

        fetchUsers();
      } catch (fallbackError: any) {
        toast({
          title: t('common.error'),
          description: fallbackError.message || t('users.failedToDeleteUser'),
          variant: 'destructive',
        });
      }
    }
  };

  const deleteUser = async (user: UserWithRole) => {
    // This function is now just a wrapper that calls openDeleteDialog
    openDeleteDialog(user);
  };

  if (authLoading || isLoading) {
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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {t('users.manageUsers')}
            </h1>
            <p className="text-muted-foreground text-sm">
              {users.length} {t('users.usersRegistered')}
            </p>
          </div>
        </div>
      </div>

      {/* Password Verification Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={(open) => {
        setIsPasswordDialogOpen(open);
        if (!open) {
          setCurrentPassword('');
          setEditingUser(null);
        }
      }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="font-display flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-600" />
              {t('users.adminSecurityVerification')}
            </DialogTitle>
            <DialogDescription>
              {t('users.securityVerificationDesc', { action: pendingAction === 'edit' ? t('common.editing') : t('common.deleting') })}
              <br />
              <span className="text-xs text-muted-foreground mt-2 block">
                {t('users.securityVerificationDesc2')}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 text-amber-800">
                <Shield className="h-4 w-4" />
                <span className="font-medium">{t('users.securityNotice')}</span>
              </div>
              <p className="text-sm text-amber-700 mt-1">
                {pendingAction === 'edit' ? t('common.editing') : t('common.deleting')}: <strong>{editingUser?.full_name}</strong> ({editingUser?.email})
              </p>
              {pendingAction === 'delete' && (
                <p className="text-sm text-red-600 mt-1 font-medium">
                  ⚠️ {t('users.permanentRemoveAdmin')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t('users.currentPassword')} *</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t('users.enterCurrentPassword')}
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
                  setEditingUser(null);
                  setPendingAction(null);
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button 
                onClick={verifyCurrentPassword} 
                disabled={isVerifyingPassword || !currentPassword.trim()}
                className={`gap-2 ${pendingAction === 'delete' ? 'bg-red-600 hover:bg-red-700' : ''}`}
              >
                {isVerifyingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('users.verifyAndAction', { action: pendingAction === 'edit' ? t('common.edit') : t('common.delete') })}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="font-display">{t('users.editUser')}</DialogTitle>
            <DialogDescription>
              {t('users.updateUserInfo')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 pt-2 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">{t('players.fullName')} *</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('users.fullNamePlaceholder')}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('users.emailAddress')} *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('players.emailPlaceholder')}
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
                      <span>{t('users.userViewOnly')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="player">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      <span>{t('users.roles.player')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <span>{t('users.roles.admin')}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('users.saveChanges')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('users.user')}</TableHead>
                <TableHead>{t('users.email')}</TableHead>
                <TableHead>{t('users.role')}</TableHead>
                <TableHead>{t('users.created')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const config = roleConfig[user.role];
                const Icon = config.icon;
                
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('capitalize', config.bgColor, config.color)}>
                        <Icon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(user)}
                          title={user.role === 'admin' ? t('users.editAdminVerification') : t('users.editUser')}
                          className={user.role === 'admin' ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50' : ''}
                        >
                          {user.role === 'admin' ? (
                            <div className="flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              <Edit className="h-4 w-4" />
                            </div>
                          ) : (
                            <Edit className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteUser(user)}
                          title={user.role === 'admin' ? t('users.deleteAdminVerification') : t('users.deleteUser')}
                          className={`text-destructive hover:text-destructive hover:bg-destructive/10 ${
                            user.role === 'admin' ? 'text-red-600 hover:text-red-700' : ''
                          }`}
                        >
                          {user.role === 'admin' ? (
                            <div className="flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              <Trash2 className="h-4 w-4" />
                            </div>
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
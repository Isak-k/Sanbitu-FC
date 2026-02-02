import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Shield } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: t('auth.loginFailed'),
        description: error.message || t('auth.invalidCredentials'),
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    toast({
      title: t('auth.welcomeBack'),
      description: t('auth.loginSuccess'),
    });
    
    navigate('/dashboard');
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-foreground/80 font-medium">
          {t('auth.email')}
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-12 bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-foreground/80 font-medium">
          {t('auth.password')}
        </Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="h-12 bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20"
        />
      </div>

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base transition-all duration-300 hover:shadow-lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('common.loading')}
          </>
        ) : (
          <>
            <Shield className="mr-2 h-5 w-5" />
            {t('auth.signIn')}
          </>
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Access is restricted to registered members only.
        <br />
        Contact your administrator for access.
      </p>
    </form>
  );
}

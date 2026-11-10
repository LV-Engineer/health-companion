import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, ChevronDown, ChevronUp, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

interface UserDropdownProps {
  variant?: 'header' | 'sidebar';
}

export const UserDropdown: React.FC<UserDropdownProps> = ({ variant = 'header' }) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (!user) {
    return (
      <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>
        Sign In
      </Button>
    );
  }

  const isSidebar = variant === 'sidebar';
  // Show the name the user chose in Profile; fall back to the email until it is set.
  const displayName = profile?.display_name?.trim() || user.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {isSidebar ? (
          <Button variant="ghost" className="w-full justify-start gap-2 h-auto py-1.5 px-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Profile</p>
            </div>
            <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="gap-2">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline max-w-[120px] truncate">{displayName}</span>
            <ChevronDown className="w-3 h-3" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={isSidebar ? 'start' : 'end'}
        side={isSidebar ? 'top' : 'bottom'}
        className="w-64 bg-card border border-border shadow-elevated z-50"
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">Signed in as</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
          <User className="w-4 h-4 mr-2" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/knowledge-base')} className="cursor-pointer">
          <Database className="w-4 h-4 mr-2" />
          Knowledge Base
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

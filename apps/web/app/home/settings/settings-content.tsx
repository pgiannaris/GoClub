'use client';

import { User } from '@supabase/supabase-js';

import {
  AccountDangerZone,
  UpdateAccountDetailsFormContainer,
} from '@kit/accounts/components';
import { usePersonalAccountData } from '@kit/accounts/hooks/use-personal-account-data';
import { getUserMetadataDisplayName } from '@kit/accounts/utils/get-user-metadata-display-name';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import { LoadingOverlay } from '@kit/ui/loading-overlay';

export function SettingsPageContent({ user }: { user: User }) {
  const accountQuery = usePersonalAccountData(user.id);

  if (accountQuery.isPending) {
    return (
      <div className="mx-auto w-full max-w-4xl py-16">
        <LoadingOverlay fullPage={false} />
      </div>
    );
  }

  const displayName =
    accountQuery.data?.name ?? getUserMetadataDisplayName(user) ?? '';
  const displayNameLabel = displayName || 'Not set';

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-1">
            <p className="text-sm font-medium">Full Name</p>
            <p className="text-muted-foreground text-sm">{displayNameLabel}</p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Email</p>
            <p className="text-muted-foreground text-sm">
              {user.email || 'Not set'}
            </p>
          </div>

          <div className="border-t pt-6">
            <UpdateAccountDetailsFormContainer
              user={{
                id: user.id,
                name: displayName || null,
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>View your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">User ID</p>
            <p className="text-muted-foreground text-sm">{user.id}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Provider</p>
            <p className="text-muted-foreground text-sm">
              {user.app_metadata.provider ? user.app_metadata.provider : 'N/A'}
            </p>
          </div>

          <div className="border-t pt-6">
            <AccountDangerZone />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

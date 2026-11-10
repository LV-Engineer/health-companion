import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { KnowledgeBaseManager } from '@/components/settings/KnowledgeBaseManager';

// Signed-out users never reach this page: the route is wrapped in RequireAuth.
const KnowledgeBasePage: React.FC = () => {
  const navigate = useNavigate();

  const handleBack = () => navigate(-1);

  return (
    <AppShell title="Knowledge Base" showBack onBack={handleBack} backTooltip="Go back to chat">
      {/* AppShell's main area is overflow-hidden, so the page must scroll itself. */}
      <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="container max-w-2xl mx-auto py-8 px-4 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge Base</h1>
          <p className="text-muted-foreground">
            Upload and manage the documents the AI uses to answer your questions.
          </p>
        </div>

        <KnowledgeBaseManager />

        <div className="pt-4">
          <Button variant="outline" onClick={handleBack} className="w-full">
            Done
          </Button>
        </div>
      </div>
      </div>
    </AppShell>
  );
};

export default KnowledgeBasePage;

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Bot,
  Sparkles,
  Settings2,
  BarChart3,
  Zap,
  Clock,
  Feather,
  LayoutGrid,
  Brain,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AiAgentOverview } from '@/components/agents/ai-agent-overview';
import { AiActionsManager } from '@/components/settings/ai-actions-manager';
import { AutomatedFollowupManager } from '@/components/settings/automated-followup-manager';
import { AiBrainPersonality } from '@/components/agents/ai-brain-personality';
import { AiCopywriterStudio } from '@/components/agents/ai-copywriter-studio';
import { AiPlayground } from '@/components/agents/ai-playground';
import { AiUsageCard } from '@/components/agents/ai-usage';
import { AiConfig } from '@/components/settings/ai-config';
import { useAuth } from '@/hooks/use-auth';
import { canEditSettings } from '@/lib/auth/roles';

type Tab =
  | 'overview'
  | 'brain'
  | 'actions'
  | 'followups'
  | 'copywriter'
  | 'playground'
  | 'setup'
  | 'usage';

export default function AgentsPage() {
  return (
    <Suspense fallback={null}>
      <AgentsPageInner />
    </Suspense>
  );
}

function AgentsPageInner() {
  const t = useTranslations('Agents');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accountRole } = useAuth();
  const canViewUsage = accountRole ? canEditSettings(accountRole) : false;

  const urlTab = searchParams.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(urlTab || 'overview');

  useEffect(() => {
    if (urlTab && urlTab !== tab) {
      setTab(urlTab);
    }
  }, [urlTab]);

  const handleTabChange = (next: string) => {
    const nextTab = next as Tab;
    setTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', nextTab);
    router.replace(`/agents?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                AI Autonomous Agents Command Center
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 sm:text-sm">
                স্বয়ংক্রিয় সেলস এজেন্ট, কুরিয়ার বুকিং, ফ্রড চেক, ফলোআপ ও কাস্টম টুলস কন্ট্রোল হাব
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-10 p-1 bg-muted/60 inline-flex w-auto min-w-full sm:min-w-0">
            <TabsTrigger value="overview" className="text-xs gap-1.5 h-8">
              <LayoutGrid className="h-3.5 w-3.5" /> Overview (ওভারভিউ)
            </TabsTrigger>
            <TabsTrigger value="brain" className="text-xs gap-1.5 h-8">
              <Brain className="h-3.5 w-3.5 text-violet-500" /> Brain & Learning (ব্রেন ও লার্নিং)
            </TabsTrigger>
            <TabsTrigger value="actions" className="text-xs gap-1.5 h-8">
              <Zap className="h-3.5 w-3.5 text-amber-500" /> Actions & Tools (অ্যাকশন)
            </TabsTrigger>
            <TabsTrigger value="followups" className="text-xs gap-1.5 h-8">
              <Clock className="h-3.5 w-3.5 text-blue-500" /> Follow-ups (ফলোআপ)
            </TabsTrigger>
            <TabsTrigger value="copywriter" className="text-xs gap-1.5 h-8">
              <Feather className="h-3.5 w-3.5 text-purple-500" /> Copywriter (কপিরাইটার)
            </TabsTrigger>
            <TabsTrigger value="playground" className="text-xs gap-1.5 h-8">
              <Sparkles className="h-3.5 w-3.5 text-emerald-500" /> Test Simulator (টেস্ট)
            </TabsTrigger>
            <TabsTrigger value="setup" className="text-xs gap-1.5 h-8">
              <Settings2 className="h-3.5 w-3.5" /> Brain Setup (কনফিগ)
            </TabsTrigger>
            {canViewUsage && (
              <TabsTrigger value="usage" className="text-xs gap-1.5 h-8">
                <BarChart3 className="h-3.5 w-3.5" /> Usage (অ্যানালিটিক্স)
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="mt-4">
          <AiAgentOverview onNavigateTab={handleTabChange} />
        </TabsContent>

        {/* Tab: Brain Personality & Learning */}
        <TabsContent value="brain" className="mt-4">
          <AiBrainPersonality />
        </TabsContent>

        {/* Tab 2: Autonomous Actions & Custom Tools */}
        <TabsContent value="actions" className="mt-4">
          <AiActionsManager />
        </TabsContent>

        {/* Tab 3: Follow-ups & Recovery */}
        <TabsContent value="followups" className="mt-4">
          <AutomatedFollowupManager />
        </TabsContent>

        {/* Tab 4: Copywriter Studio */}
        <TabsContent value="copywriter" className="mt-4">
          <AiCopywriterStudio />
        </TabsContent>

        {/* Tab 5: Test Playground */}
        <TabsContent value="playground" className="mt-4">
          <AiPlayground onGoToSetup={() => handleTabChange('setup')} />
        </TabsContent>

        {/* Tab 6: Setup */}
        <TabsContent value="setup" className="mt-4">
          <AiConfig />
        </TabsContent>

        {/* Tab 7: Token Usage */}
        {canViewUsage && (
          <TabsContent value="usage" className="mt-4">
            <AiUsageCard />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

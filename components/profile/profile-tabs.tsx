"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type ProfileTab = { id: string; label: string; content: React.ReactNode };

/** The tabs of the profile screen. The address keeps the chosen tab, so a refresh stays put. */
export function ProfileTabs({ tabs, defaultTab }: { tabs: ProfileTab[]; defaultTab: string }) {
  return (
    <Tabs
      defaultValue={defaultTab}
      onValueChange={(value) => {
        const url = new URL(window.location.href);
        url.searchParams.set("tab", value);
        window.history.replaceState(null, "", url);
      }}
    >
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="flex flex-col gap-10">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

import { AppLayout } from "@/components/layout/AppLayout";
import { Users, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

const Community = () => {
  return (
    <AppLayout>
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="max-w-lg w-full p-12 text-center">
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <Users className="h-20 w-20 text-primary" />
              <Sparkles className="h-8 w-8 text-primary absolute -top-2 -right-2 animate-pulse" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-4">Community Templates</h1>
          <p className="text-muted-foreground text-lg mb-6">
            Coming Soon
          </p>
          <p className="text-muted-foreground">
            We're working on building an amazing community template library where healthcare professionals can share and discover clinical documentation templates.
          </p>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Community;

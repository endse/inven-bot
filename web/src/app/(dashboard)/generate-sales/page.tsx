import GenerateClient from "./GenerateClient";
import { prisma } from "@/lib/prisma";

export default async function GenerateSalesPage() {
  const pendingDrafts = await prisma.invoiceDraft.findMany({
    where: {
      imageUrl: "SYSTEM_GENERATED",
      status: "pending_review"
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-4">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">Auto Sales Generator</h1>
          <p className="text-zinc-500 mt-2 text-lg font-medium">Leverage AI to create realistic, bundled sales invoices to populate your inventory.</p>
        </div>
      </div>
      
      <GenerateClient initialDrafts={pendingDrafts} />
    </div>
  );
}

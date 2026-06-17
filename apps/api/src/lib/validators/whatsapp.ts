import { z } from "zod";

export const sendWhatsAppMessageBodySchema = z.object({
  leadId: z.string().uuid(),
  templateId: z.string().uuid(),
  variables: z.record(z.string(), z.string()).optional().default({}),
});

export type SendWhatsAppMessageBody = z.infer<typeof sendWhatsAppMessageBodySchema>;


import { tool } from "ai";
import { z } from "zod";
import type { Env } from "../env";
import { Db } from "../db/client";
import { LeadsRepo } from "../db/leads";
import { messageOwner } from "./handoffHuman";

export function captureLeadTool(
  env: Env,
  getConversationId: () => string | null,
) {
  return tool({
    description:
      "Registra a una persona interesada en adquirir una membresía. Captura su nombre, teléfono o correo y el plan elegido. No confirma compras ni pagos.",

    inputSchema: z.object({
      name: z.string().describe("Nombre del interesado"),
      contact: z.string().describe("Teléfono o correo del interesado"),
      plan: z.enum(["mensual", "anual"]).optional().describe("Plan de membresía elegido"),
      intent: z.string().describe("Qué desea adquirir el cliente"),
      notes: z.string().optional(),
    }),

    execute: async ({ name, contact, plan, intent, notes }) => {
      const convId = getConversationId();
      const leads = new LeadsRepo(new Db(env.DB), env);

      const leadId = await leads.create({
        conversationId: convId,
        name,
        contact,
        channelUserId: null,
        intent,
        notes,
        metadata: {
          plan: plan ?? null,
        },
      });

      // Notificación al responsable del negocio.
      // Se envía únicamente si Telegram está configurado.
      if (env.TELEGRAM_BOT_TOKEN && env.OWNER_TELEGRAM_CHAT_ID) {
        await messageOwner(env, {
          heading: "Nuevo interesado en ORUM",
          body: [
            `Nombre: ${name}`,
            `Contacto: ${contact}`,
            `Plan: ${plan ?? "Por confirmar"}`,
            `Interés: ${intent}`,
            `Lead ID: ${leadId}`,
          ].join("\n"),
        });
      }

      return {
        leadId,
        message: "Interesado registrado correctamente.",
      };
    },
  });
}

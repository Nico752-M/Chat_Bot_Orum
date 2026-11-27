
// member/config.local.ts — configuración de ORUM.
// NUNCA se sobrescribe al actualizar el bot.

export const memberConfig = {
  businessName: "Orum",
  botName: "Asistente de Orum",
  language: "es" as "es" | "en" | "pt",
  tier: "free" as "free" | "pro",
  timezone: "America/Bogota",
  currency: "$",
  contactEmail: "soporte@cluborum.com",
};

export type MemberConfig = typeof memberConfig;

export const businessConfig = {
  hours: "Por confirmar",
  services: [
    {
      name: "Membresía mensual ORUM",
      price: 30000,
    },
    {
      name: "Membresía anual ORUM",
      price: 250000,
    },
  ],
  location: "Colombia. Consulta los comercios aliados en cluborum.com/explorar",
  paymentMethods: ["Mercado Pago"] as string[],
  contactPhone: "+573105108191",

  customFields: {
    queHacemos:
      "ORUM es un club de beneficios por membresía que conecta personas con comercios aliados para que puedan disfrutar descuentos y beneficios en establecimientos participantes.",

    ofrecemos:
      "Membresías mensuales y anuales que permiten acceder a beneficios en comercios aliados como restaurantes, bares, spas, viajes y otros establecimientos. Ambas incluyen tarjeta física y carnet digital, y permiten disfrutar beneficios desde el primer día.",

    tono:
      "Formal, cercano, amable y profesional. Hablar de manera natural, explicar con claridad y no utilizar emojis.",

    sitioWebYRedes:
      "Página web: https://cluborum.com. Directorio de comercios aliados: https://cluborum.com/explorar. Soporte: soporte@cluborum.com. Teléfono provisional de contacto: +57 310 510 8191.",

    preguntasFrecuentes:
      "¿Qué es ORUM y cómo funciona? ORUM es un club de beneficios por membresía que conecta socios con comercios aliados. ¿Cuánto cuesta? La membresía mensual cuesta $30.000 COP y la anual $250.000 COP. ¿Cuál es la ventaja de la anual? Permite ahorrar $110.000 COP frente a pagar doce mensualidades. ¿Qué incluye? Ambas membresías incluyen beneficios desde el primer día, tarjeta física y carnet digital. ¿Cómo utilizo los beneficios? Debes presentar tu carnet y cédula en el comercio aliado. ¿Dónde consulto los comercios? En https://cluborum.com/explorar. ¿Hay cobros automáticos? No, la renovación se realiza únicamente si el socio desea continuar. ¿Cómo cancelo o solicito un reembolso? Puedes consultar las condiciones en https://cluborum.com/reembolsos.",

    reglasYEscalacion:
      "El asistente debe gestionar de forma autónoma la atención comercial y venta de membresías. Debe explicar qué es ORUM, sus beneficios, los comercios aliados, los planes, los precios y las diferencias entre las membresías. Debe orientar al cliente durante el proceso de compra y resolver sus dudas sin transferir automáticamente la conversación. Debe escalar al equipo humano cuando existan problemas de pago o cuando el cliente presente una solicitud concreta de reembolso. Puede explicar la política de reembolsos sin escalar una simple pregunta informativa. Nunca debe inventar métodos de pago, horarios, condiciones comerciales ni información que no esté confirmada. Si desconoce una respuesta, debe reconocerlo y orientar al cliente hacia el equipo de soporte."
  } as Record<string, string>,
};

import type { CommentFunnel } from "../src/channels/comment-funnel";

export const commentFunnels: CommentFunnel[] = [];

export const catalog: {
  name: string;
  price: number;
  description?: string;
  sku?: string;
}[] = [];

import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => ts("created_at").notNull().defaultNow();

export type Role = "admin" | "employee" | "client";
export type EmployeePermissions = {
  manageAvailability: boolean;
  createTreatments: boolean;
  viewClientContacts: boolean;
};
export const DEFAULT_PERMISSIONS: EmployeePermissions = {
  manageAvailability: true,
  createTreatments: true,
  viewClientContacts: true,
};

/** Ogni centro estetico è un tenant isolato: tutte le tabelle portano center_id. */
export const centers = pgTable("centers", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull().default(""),
  address: text("address").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  timezone: text("timezone").notNull().default("Europe/Rome"),
  // Prenotazioni
  cancellationHours: integer("cancellation_hours").notNull().default(24),
  bufferMinutes: integer("buffer_minutes").notNull().default(10),
  slotIntervalMinutes: integer("slot_interval_minutes").notNull().default(15),
  bookingHorizonDays: integer("booking_horizon_days").notNull().default(60),
  minAdvanceMinutes: integer("min_advance_minutes").notNull().default(60),
  reminderHours: integer("reminder_hours").notNull().default(24),
  // Fedeltà
  pointsPerEuro: integer("points_per_euro_x100").notNull().default(100), // centesimi di punto per euro
  pointsPerTreatment: integer("points_per_treatment").notNull().default(0),
  // Compleanni
  birthdayEnabled: boolean("birthday_enabled").notNull().default(true),
  birthdayMessage: text("birthday_message")
    .notNull()
    .default("Tanti auguri {nome}! Tutto il nostro team ti augura una giornata speciale."),
  birthdayGift: text("birthday_gift").notNull().default(""),
  birthdayBonusPoints: integer("birthday_bonus_points").notNull().default(0),
  createdAt: createdAt(),
});

export const images = pgTable("images", {
  id: id(),
  centerId: uuid("center_id").notNull().references(() => centers.id, { onDelete: "cascade" }),
  mime: text("mime").notNull(),
  data: bytea("data").notNull(),
  createdAt: createdAt(),
});

export const users = pgTable(
  "users",
  {
    id: id(),
    centerId: uuid("center_id").notNull().references(() => centers.id, { onDelete: "cascade" }),
    role: text("role").$type<Role>().notNull(),
    email: text("email"),
    passwordHash: text("password_hash"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    phone: text("phone").notNull().default(""),
    birthDate: date("birth_date"),
    notes: text("notes").notNull().default(""), // note interne (clienti) / bio (dipendenti)
    jobTitle: text("job_title").notNull().default(""),
    color: text("color").notNull().default("#C9A96E"),
    active: boolean("active").notNull().default(true),
    permissions: jsonb("permissions").$type<EmployeePermissions>(),
    pointsBalance: integer("points_balance").notNull().default(0),
    lastBirthdayYear: integer("last_birthday_year"),
    sessionVersion: integer("session_version").notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("users_email_unique").on(sql`lower(${t.email})`),
    index("users_center_role_idx").on(t.centerId, t.role),
  ],
);

export const categories = pgTable("categories", {
  id: id(),
  centerId: uuid("center_id").notNull().references(() => centers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sort: integer("sort").notNull().default(0),
});

export type TreatmentStatus = "approved" | "pending" | "rejected";
export const treatments = pgTable(
  "treatments",
  {
    id: id(),
    centerId: uuid("center_id").notNull().references(() => centers.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    notes: text("notes").notNull().default(""),
    durationMinutes: integer("duration_minutes").notNull(),
    priceCents: integer("price_cents").notNull(),
    imageId: uuid("image_id").references(() => images.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    status: text("status").$type<TreatmentStatus>().notNull().default("approved"),
    // Regola di disdetta specifica (ore). null = regola del centro.
    cancellationHours: integer("cancellation_hours"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("treatments_center_idx").on(t.centerId)],
);

export const employeeTreatments = pgTable(
  "employee_treatments",
  {
    employeeId: uuid("employee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    treatmentId: uuid("treatment_id").notNull().references(() => treatments.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.employeeId, t.treatmentId] })],
);

/** Turni settimanali ricorrenti. Più fasce nello stesso giorno = pause tra una fascia e l'altra. */
export const workShifts = pgTable(
  "work_shifts",
  {
    id: id(),
    centerId: uuid("center_id").notNull().references(() => centers.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(), // 0 = domenica … 6 = sabato
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
  },
  (t) => [index("shifts_employee_idx").on(t.employeeId)],
);

/** Eccezioni al turno: ferie/indisponibilità oppure disponibilità straordinarie. */
export const availabilityExceptions = pgTable(
  "availability_exceptions",
  {
    id: id(),
    centerId: uuid("center_id").notNull().references(() => centers.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"unavailable" | "available">().notNull(),
    startAt: ts("start_at").notNull(),
    endAt: ts("end_at").notNull(),
    reason: text("reason").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("exceptions_employee_idx").on(t.employeeId, t.startAt)],
);

export type AppointmentStatus = "confirmed" | "completed" | "cancelled" | "no_show";
export const appointments = pgTable(
  "appointments",
  {
    id: id(),
    centerId: uuid("center_id").notNull().references(() => centers.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id").notNull().references(() => users.id),
    treatmentId: uuid("treatment_id").notNull().references(() => treatments.id),
    promotionId: uuid("promotion_id"),
    startAt: ts("start_at").notNull(),
    endAt: ts("end_at").notNull(),
    status: text("status").$type<AppointmentStatus>().notNull().default("confirmed"),
    priceCents: integer("price_cents").notNull(),
    notes: text("notes").notNull().default(""),
    pointsAwarded: integer("points_awarded"),
    reminderSentAt: ts("reminder_sent_at"),
    cancelledAt: ts("cancelled_at"),
    cancelledBy: uuid("cancelled_by"),
    createdBy: uuid("created_by"),
    createdAt: createdAt(),
  },
  (t) => [
    index("appointments_center_start_idx").on(t.centerId, t.startAt),
    index("appointments_client_idx").on(t.clientId, t.startAt),
    index("appointments_employee_idx").on(t.employeeId, t.startAt),
  ],
);

export const PROMO_CATEGORIES = [
  ["massaggi", "Promo massaggi"],
  ["viso", "Promo viso"],
  ["corpo", "Promo corpo"],
  ["prodotti", "Promo prodotti"],
  ["pacchetti", "Pacchetti speciali"],
  ["stagionali", "Offerte stagionali"],
  ["luxury", "Trattamenti Luxury"],
] as const;
export type PromoCategory = (typeof PROMO_CATEGORIES)[number][0];

export const promotions = pgTable("promotions", {
  id: id(),
  centerId: uuid("center_id").notNull().references(() => centers.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").$type<PromoCategory>().notNull(),
  imageId: uuid("image_id").references(() => images.id, { onDelete: "set null" }),
  originalPriceCents: integer("original_price_cents"),
  promoPriceCents: integer("promo_price_cents"),
  treatmentId: uuid("treatment_id").references(() => treatments.id, { onDelete: "set null" }),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const events = pgTable("events", {
  id: id(),
  centerId: uuid("center_id").notNull().references(() => centers.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  imageId: uuid("image_id").references(() => images.id, { onDelete: "set null" }),
  startsAt: ts("starts_at").notNull(),
  endsAt: ts("ends_at"),
  location: text("location").notNull().default(""),
  maxParticipants: integer("max_participants"),
  priceCents: integer("price_cents").notNull().default(0),
  published: boolean("published").notNull().default(true),
  createdAt: createdAt(),
});

export const eventRegistrations = pgTable(
  "event_registrations",
  {
    id: id(),
    centerId: uuid("center_id").notNull().references(() => centers.id, { onDelete: "cascade" }),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    seats: integer("seats").notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("event_user_unique").on(t.eventId, t.userId)],
);

export const rewards = pgTable("rewards", {
  id: id(),
  centerId: uuid("center_id").notNull().references(() => centers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  pointsCost: integer("points_cost").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const redemptions = pgTable(
  "redemptions",
  {
    id: id(),
    centerId: uuid("center_id").notNull().references(() => centers.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    rewardId: uuid("reward_id").references(() => rewards.id, { onDelete: "set null" }),
    rewardName: text("reward_name").notNull(),
    pointsSpent: integer("points_spent").notNull(),
    code: text("code").notNull().unique(),
    status: text("status").$type<"active" | "used" | "cancelled">().notNull().default("active"),
    usedAt: ts("used_at"),
    createdAt: createdAt(),
  },
  (t) => [index("redemptions_user_idx").on(t.userId)],
);

export type PointsType = "earn" | "redeem" | "manual" | "refund" | "birthday";
export const pointsTransactions = pgTable(
  "points_transactions",
  {
    id: id(),
    centerId: uuid("center_id").notNull().references(() => centers.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    type: text("type").$type<PointsType>().notNull(),
    reason: text("reason").notNull().default(""),
    appointmentId: uuid("appointment_id"),
    createdBy: uuid("created_by"),
    createdAt: createdAt(),
  },
  (t) => [index("points_user_idx").on(t.userId, t.createdAt), index("points_center_idx").on(t.centerId, t.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    centerId: uuid("center_id").notNull().references(() => centers.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    url: text("url").notNull().default("/"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: createdAt(),
});

/** Storico delle comunicazioni inviate dall'amministratore. */
export const broadcasts = pgTable("broadcasts", {
  id: id(),
  centerId: uuid("center_id").notNull().references(() => centers.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  audience: text("audience").notNull(),
  recipients: integer("recipients").notNull().default(0),
  createdAt: createdAt(),
});

/** Configurazione globale (segreti generati automaticamente, chiavi VAPID…). */
export const appConfig = pgTable("app_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Center = typeof centers.$inferSelect;
export type User = typeof users.$inferSelect;
export type Treatment = typeof treatments.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type Promotion = typeof promotions.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type Reward = typeof rewards.$inferSelect;
export type Redemption = typeof redemptions.$inferSelect;

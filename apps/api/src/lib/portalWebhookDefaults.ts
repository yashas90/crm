export const PORTAL_NAMES = ["99acres", "magicbricks", "housing", "indiamrt", "other"] as const;

export type PortalName = (typeof PORTAL_NAMES)[number];

export type PortalFieldMapping = {
  name: string;
  phone: string;
  email?: string;
  message?: string;
  projectInterest?: string;
};

export const DEFAULT_PORTAL_FIELD_MAPPINGS: Record<PortalName, PortalFieldMapping> = {
  "99acres": {
    name: "sender_name",
    phone: "sender_phone",
    email: "sender_email",
    message: "message",
    projectInterest: "property_name",
  },
  magicbricks: {
    name: "Name",
    phone: "Mobile",
    email: "Email",
    message: "Message",
    projectInterest: "Project",
  },
  housing: {
    name: "name",
    phone: "phone",
    email: "email",
    message: "remarks",
    projectInterest: "project_name",
  },
  indiamrt: {
    name: "SENDERNAME",
    phone: "MOB",
    email: "SENDEREMAIL",
    message: "Query",
    projectInterest: "GLUSR_USR_PRODUCT_NAME",
  },
  other: {
    name: "name",
    phone: "phone",
    email: "email",
    message: "message",
    projectInterest: "project",
  },
};

export const PORTAL_LEAD_SOURCE_LABELS: Record<PortalName, string> = {
  "99acres": "99acres",
  magicbricks: "MagicBricks",
  housing: "Housing.com",
  indiamrt: "IndiaMART",
  other: "Property Portal",
};

export const PORTAL_MOCK_PAYLOADS: Record<PortalName, Record<string, string>> = {
  "99acres": {
    sender_name: "Rahul Sharma",
    sender_phone: "9876543210",
    sender_email: "rahul@example.com",
    message: "Interested in 3BHK",
    property_name: "Sunrise Heights",
  },
  magicbricks: {
    Name: "Priya Patel",
    Mobile: "8765432109",
    Email: "priya@example.com",
    Message: "Please call back",
    Project: "Green Valley",
  },
  housing: {
    name: "Amit Kumar",
    phone: "7654321098",
    email: "amit@example.com",
    remarks: "Site visit requested",
    project_name: "Lake View Residency",
  },
  indiamrt: {
    SENDERNAME: "Neha Singh",
    MOB: "9123456789",
    SENDEREMAIL: "neha@example.com",
    Query: "Need pricing details",
    GLUSR_USR_PRODUCT_NAME: "Commercial Plot",
  },
  other: {
    name: "Test Lead",
    phone: "9988776655",
    email: "test@example.com",
    message: "General inquiry",
    project: "Demo Project",
  },
};

export function resolvePortalFieldMapping(
  portalName: PortalName,
  override?: PortalFieldMapping | null,
): PortalFieldMapping {
  if (override && Object.keys(override).length > 0) {
    return { ...DEFAULT_PORTAL_FIELD_MAPPINGS[portalName], ...override };
  }
  return DEFAULT_PORTAL_FIELD_MAPPINGS[portalName];
}

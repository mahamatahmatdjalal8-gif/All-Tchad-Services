import { and, eq, or } from "drizzle-orm";
import { serviceRequests } from "../db/schema";

type Mission = { requestKind: string; requesterExpertId: number | null; targetExpertId: number | null; expertDecision: string; status: string };

// A person's name is never an authorization key: two accounts can share it.
export function ownedServiceMissions(memberId: number) {
  return and(eq(serviceRequests.requestKind, "service"), or(eq(serviceRequests.requesterExpertId, memberId), eq(serviceRequests.targetExpertId, memberId)));
}

export function isMissionParticipant(mission: Mission, memberId: number) {
  return mission.requestKind === "service" && (mission.requesterExpertId === memberId || mission.targetExpertId === memberId);
}

export function hasMissionConversation(mission: Mission) {
  return mission.requestKind === "service" && Boolean(mission.requesterExpertId && mission.targetExpertId) && mission.expertDecision === "accepted" && ["assigned", "in_progress", "completed"].includes(mission.status);
}

export function canSendMissionMessage(mission: Mission) {
  return hasMissionConversation(mission) && mission.status !== "completed";
}

export function withoutAccessCode<T extends { accessCodeHash?: unknown }>(row: T): Omit<T, "accessCodeHash"> {
  const { accessCodeHash: omitted, ...safe } = row;
  void omitted;
  return safe;
}

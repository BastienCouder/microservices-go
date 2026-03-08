import { projects } from "./projects";
import { prompts } from "./prompts";
import { competitors } from "./competitors";
import { aiModels } from "./ai-models";
import { projectModels } from "./project-models";
import { outboxEvents } from "./outbox-events";

export const schema = {
    projects,
    prompts,
    competitors,
    aiModels,
    projectModels,
    outboxEvents,
};

export { projects, prompts, competitors, aiModels, projectModels, outboxEvents };

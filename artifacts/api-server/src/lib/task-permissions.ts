type Actor = { id: number; role: string };
type DeletableTask = { boardId: number | null; creatorId: number };

export function canDeleteTask(actor: Actor, task: DeletableTask): boolean {
  if (task.boardId === null) return task.creatorId === actor.id;
  return actor.role === "admin";
}

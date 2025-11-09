import type { Database, Schema } from "./index.ts";
import { todos } from "./schema.ts";

export type { Database, Schema };

export type { Todo, NewTodo } from "./schema.ts";

export type TodosTable = typeof todos;

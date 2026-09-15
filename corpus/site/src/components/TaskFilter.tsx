import { createContext, useContext } from "react";
import type { TaskFilter } from "@/lib/taskFilter";

export const TaskContext = createContext<TaskFilter>("all");
export const useTask = () => useContext(TaskContext);

export function TaskSelector({
	task,
	onChange,
}: {
	task: TaskFilter;
	onChange: (task: TaskFilter) => void;
}) {
	return (
		<fieldset className="mb-6 flex flex-wrap gap-1 border-0 p-0">
			<legend className="eyebrow mb-2">Speaking task</legend>
			{(["all", "T1", "T2"] as const).map((value) => (
				<button
					key={value}
					type="button"
					aria-pressed={task === value}
					onClick={() => onChange(value)}
					className={`rounded-[2px] px-3 py-2 font-mono text-xs transition-colors ${task === value ? "bg-[var(--color-ink)] text-[var(--color-paper)]" : "text-[var(--color-ink-soft)] hover:bg-[var(--color-paper-deep)]"}`}
				>
					{value === "all"
						? "All"
						: value === "T1"
							? "Read-aloud"
							: "Interview"}
				</button>
			))}
		</fieldset>
	);
}

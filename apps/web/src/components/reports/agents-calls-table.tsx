import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";

type AgentRow = {
  user_id: string;
  name: string;
  total_calls: number;
  completed_calls: number;
  avg_duration: number;
};

export function AgentsCallsTable({ agents }: { agents: AgentRow[] }) {
  const maxCalls = Math.max(...agents.map((agent) => agent.total_calls), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Calls by agent</CardTitle>
      </CardHeader>
      <CardContent>
        {agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No call activity for this period.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Total calls</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Avg duration</TableHead>
                <TableHead className="w-[140px]">Volume</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.user_id}>
                  <TableCell className="font-medium">{agent.name}</TableCell>
                  <TableCell>{agent.total_calls}</TableCell>
                  <TableCell>{agent.completed_calls}</TableCell>
                  <TableCell>{agent.avg_duration}s</TableCell>
                  <TableCell>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${(agent.total_calls / maxCalls) * 100}%` }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

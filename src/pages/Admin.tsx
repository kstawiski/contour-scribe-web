import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface User { id: number; name: string; }
interface Task { id: number; name: string; assignedTo: number | null; }

const Admin = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userName, setUserName] = useState('');
  const [taskName, setTaskName] = useState('');
  const [taskUser, setTaskUser] = useState<string>('');

  const addUser = () => {
    if (!userName.trim()) return;
    setUsers([...users, { id: Date.now(), name: userName.trim() }]);
    setUserName('');
  };

  const addTask = () => {
    if (!taskName.trim()) return;
    const assigned = taskUser ? parseInt(taskUser) : null;
    setTasks([...tasks, { id: Date.now(), name: taskName.trim(), assignedTo: assigned }]);
    setTaskName('');
    setTaskUser('');
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create User</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input placeholder="User name" value={userName} onChange={e => setUserName(e.target.value)} />
          <Button onClick={addUser} variant="medical">Add</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create Task</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Input placeholder="Task name" value={taskName} onChange={e => setTaskName(e.target.value)} />
          <Select value={taskUser} onValueChange={setTaskUser}>
            <SelectTrigger>
              <SelectValue placeholder="Assign to user" />
            </SelectTrigger>
            <SelectContent>
              {users.map(u => (
                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={addTask} variant="medical">Create</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {users.map(u => (
            <div key={u.id} className="text-sm">{u.name}</div>
          ))}
          {users.length === 0 && <div className="text-sm text-muted-foreground">No users</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {tasks.map(t => {
            const user = users.find(u => u.id === t.assignedTo);
            return (
              <div key={t.id} className="text-sm">
                {t.name} {user ? `- ${user.name}` : ''}
              </div>
            );
          })}
          {tasks.length === 0 && <div className="text-sm text-muted-foreground">No tasks</div>}
        </CardContent>
      </Card>
    </div>
  );
};

export default Admin;

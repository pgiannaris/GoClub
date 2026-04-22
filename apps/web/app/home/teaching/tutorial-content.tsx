'use client';

import { useEffect, useState } from 'react';

import { User } from '@supabase/supabase-js';
import { toast } from 'sonner';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Button } from '@kit/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';

import { Database } from '~/lib/database.types';

type Account = Database['public']['Tables']['accounts']['Row'];

export function TutorialContent({ user }: { user: User }) {
  const supabase = useSupabase();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');

  // Load account data on mount
  useEffect(() => {
    loadAccount();
  }, []);

  const loadAccount = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error loading account:', error);
      toast.error('Failed to load account');
    } else {
      setAccount(data);
      setNewName(data.name);
    }
    setLoading(false);
  };

  const handleUpdate = async () => {
    if (!newName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    const { data, error } = await supabase
      .from('accounts')
      .update({ name: newName })
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Update error:', error);
      toast.error('Failed to update name');
    } else {
      setAccount(data);
      toast.success('Name updated successfully!');
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      {/* Section 1: Introduction */}
      <Card className="border-blue-500">
        <CardHeader>
          <CardTitle>📘 Welcome to Supabase Tutorial</CardTitle>
          <CardDescription>
            Learn everything you need to work with databases in this app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">What You'll Learn:</h3>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>How to use Supabase in Client Components vs Server Components</li>
              <li>SELECT - Reading data from database</li>
              <li>INSERT - Creating new records</li>
              <li>UPDATE - Modifying existing records</li>
              <li>DELETE - Removing records</li>
              <li>Real-time subscriptions (coming soon)</li>
              <li>TypeScript types for database tables</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Setup - Client vs Server */}
      <Card>
        <CardHeader>
          <CardTitle>⚙️ 1. Getting the Supabase Client</CardTitle>
          <CardDescription>Two different ways depending on component type</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4">
            <h4 className="mb-2 font-mono text-sm font-semibold">Client Components (with 'use client')</h4>
            <pre className="overflow-x-auto rounded bg-slate-950 p-3 text-xs text-green-400">
{`'use client';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';

export function MyComponent() {
  const supabase = useSupabase();
  
  // Now you can use supabase.from('table')...
}`}
            </pre>
          </div>

          <div className="rounded-lg border p-4">
            <h4 className="mb-2 font-mono text-sm font-semibold">Server Components (async)</h4>
            <pre className="overflow-x-auto rounded bg-slate-950 p-3 text-xs text-green-400">
{`import { getSupabaseServerClient } from '@kit/supabase/server-client';

export default async function MyPage() {
  const supabase = getSupabaseServerClient();
  
  const { data } = await supabase.from('accounts').select('*');
  
  return <div>{/* render data */}</div>;
}`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: SELECT - Reading Data */}
      <Card>
        <CardHeader>
          <CardTitle>📖 2. SELECT - Reading Data</CardTitle>
          <CardDescription>Fetch data from your database</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-semibold">Basic SELECT:</h4>
            <pre className="overflow-x-auto rounded bg-slate-950 p-3 text-xs text-green-400">
{`// Get all rows from accounts table
const { data, error } = await supabase
  .from('accounts')
  .select('*');

// Get specific columns only
const { data } = await supabase
  .from('accounts')
  .select('id, name, email');`}
            </pre>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">SELECT with Filters:</h4>
            <pre className="overflow-x-auto rounded bg-slate-950 p-3 text-xs text-green-400">
{`// WHERE condition - exact match
const { data } = await supabase
  .from('accounts')
  .select('*')
  .eq('id', user.id);  // WHERE id = user.id

// Get single row instead of array
const { data } = await supabase
  .from('accounts')
  .select('*')
  .eq('id', user.id)
  .single();  // Returns object, not array

// Multiple conditions
const { data } = await supabase
  .from('accounts')
  .select('*')
  .eq('id', user.id)
  .neq('name', 'Test')  // not equal
  .order('created_at', { ascending: false });`}
            </pre>
          </div>

          <div className="rounded-lg border bg-blue-50 p-3 dark:bg-blue-950">
            <p className="text-sm font-semibold">🎯 Live Example:</p>
            <p className="text-xs text-muted-foreground">
              Your account data loaded at the top of this page
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: INSERT - Creating Data */}
      <Card>
        <CardHeader>
          <CardTitle>➕ 3. INSERT - Creating New Records</CardTitle>
          <CardDescription>Add new data to your database</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-semibold">Single Insert:</h4>
            <pre className="overflow-x-auto rounded bg-slate-950 p-3 text-xs text-green-400">
{`// Insert one record
const { data, error } = await supabase
  .from('accounts')
  .insert({
    name: 'John Doe',
    email: 'john@example.com'
  })
  .select()  // Return the inserted row
  .single();

if (error) {
  console.error('Error:', error);
} else {
  console.log('Created:', data);
}`}
            </pre>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">Multiple Insert:</h4>
            <pre className="overflow-x-auto rounded bg-slate-950 p-3 text-xs text-green-400">
{`// Insert multiple records at once
const { data, error } = await supabase
  .from('accounts')
  .insert([
    { name: 'User 1', email: 'user1@example.com' },
    { name: 'User 2', email: 'user2@example.com' },
    { name: 'User 3', email: 'user3@example.com' }
  ])
  .select();  // Returns array of inserted rows`}
            </pre>
          </div>

          <div className="rounded-lg border bg-yellow-50 p-3 dark:bg-yellow-950">
            <p className="text-sm font-semibold">⚠️ Important:</p>
            <p className="text-xs text-muted-foreground">
              Make sure you have the right permissions in Supabase RLS policies
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Section 5: UPDATE - Modifying Data */}
      <Card>
        <CardHeader>
          <CardTitle>✏️ 4. UPDATE - Modifying Records</CardTitle>
          <CardDescription>Change existing data in your database</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-semibold">Basic UPDATE:</h4>
            <pre className="overflow-x-auto rounded bg-slate-950 p-3 text-xs text-green-400">
{`// Update single record
const { data, error } = await supabase
  .from('accounts')
  .update({
    name: 'New Name',
    email: 'newemail@example.com'
  })
  .eq('id', user.id)  // WHERE id = user.id
  .select()
  .single();`}
            </pre>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">Update Multiple Fields:</h4>
            <pre className="overflow-x-auto rounded bg-slate-950 p-3 text-xs text-green-400">
{`// Update with multiple conditions
const { data, error } = await supabase
  .from('accounts')
  .update({
    name: 'Updated Name',
    updated_at: new Date().toISOString()
  })
  .eq('id', userId)
  .select();`}
            </pre>
          </div>

          {/* Interactive Update Example */}
          <div className="rounded-lg border bg-green-50 p-4 dark:bg-green-950">
            <p className="mb-3 text-sm font-semibold">🎯 Try It Yourself:</p>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="name">Current Name: {account?.name}</Label>
                  <div className="mt-2 flex gap-2">
                    <Input
                      id="name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Enter new name"
                    />
                    <Button onClick={handleUpdate}>Update</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section 6: DELETE - Removing Data */}
      <Card>
        <CardHeader>
          <CardTitle>🗑️ 5. DELETE - Removing Records</CardTitle>
          <CardDescription>Delete data from your database (use carefully!)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-semibold">Basic DELETE:</h4>
            <pre className="overflow-x-auto rounded bg-slate-950 p-3 text-xs text-green-400">
{`// Delete single record
const { error } = await supabase
  .from('accounts')
  .delete()
  .eq('id', recordId);  // WHERE id = recordId

if (error) {
  console.error('Error:', error);
} else {
  console.log('Deleted successfully');
}`}
            </pre>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">Delete with Conditions:</h4>
            <pre className="overflow-x-auto rounded bg-slate-950 p-3 text-xs text-green-400">
{`// Delete multiple records matching condition
const { error } = await supabase
  .from('accounts')
  .delete()
  .eq('status', 'inactive')
  .lt('created_at', '2023-01-01');  // less than date`}
            </pre>
          </div>

          <div className="rounded-lg border bg-red-50 p-3 dark:bg-red-950">
            <p className="text-sm font-semibold">🚨 Warning:</p>
            <p className="text-xs text-muted-foreground">
              Always use .eq() or other filters with DELETE to avoid deleting all records!
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Section 7: TypeScript Types */}
      <Card>
        <CardHeader>
          <CardTitle>🔷 6. TypeScript Types</CardTitle>
          <CardDescription>Use your database schema in TypeScript</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-semibold">Import Database Types:</h4>
            <pre className="overflow-x-auto rounded bg-slate-950 p-3 text-xs text-green-400">
{`import { Database } from '~/lib/database.types';

// Get table types
type Account = Database['public']['Tables']['accounts']['Row'];
type AccountInsert = Database['public']['Tables']['accounts']['Insert'];
type AccountUpdate = Database['public']['Tables']['accounts']['Update'];

// Use in your code
const [account, setAccount] = useState<Account | null>(null);`}
            </pre>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">Type-safe Queries:</h4>
            <pre className="overflow-x-auto rounded bg-slate-950 p-3 text-xs text-green-400">
{`// TypeScript will check your column names and types
const { data } = await supabase
  .from('accounts')
  .select('id, name, email')  // ✅ Valid columns
  .eq('id', user.id);

// TypeScript error if column doesn't exist
const { data } = await supabase
  .from('accounts')
  .select('invalid_column');  // ❌ Error!`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Section 8: Error Handling */}
      <Card>
        <CardHeader>
          <CardTitle>🛡️ 7. Error Handling</CardTitle>
          <CardDescription>Handle errors properly</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-semibold">Basic Error Handling:</h4>
            <pre className="overflow-x-auto rounded bg-slate-950 p-3 text-xs text-green-400">
{`const { data, error } = await supabase
  .from('accounts')
  .select('*');

if (error) {
  console.error('Database error:', error);
  toast.error('Failed to load data');
  return;
}

// Use data here
console.log('Success:', data);`}
            </pre>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">Try-Catch Pattern:</h4>
            <pre className="overflow-x-auto rounded bg-slate-950 p-3 text-xs text-green-400">
{`async function loadData() {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .select('*');
    
    if (error) throw error;
    
    setData(data);
    toast.success('Loaded successfully');
  } catch (error) {
    console.error('Error:', error);
    toast.error('Something went wrong');
  }
}`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Section 9: Common Patterns */}
      <Card>
        <CardHeader>
          <CardTitle>🎨 8. Common Patterns</CardTitle>
          <CardDescription>Practical examples for real apps</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-semibold">Load Data on Component Mount:</h4>
            <pre className="overflow-x-auto rounded bg-slate-950 p-3 text-xs text-green-400">
{`useEffect(() => {
  async function loadData() {
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', user.id)
      .single();
    
    setAccount(data);
  }
  
  loadData();
}, []);  // Run once on mount`}
            </pre>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">Form Submit with Database:</h4>
            <pre className="overflow-x-auto rounded bg-slate-950 p-3 text-xs text-green-400">
{`async function handleSubmit(formData: FormData) {
  const name = formData.get('name');
  
  const { data, error } = await supabase
    .from('accounts')
    .update({ name })
    .eq('id', user.id)
    .select()
    .single();
  
  if (error) {
    toast.error('Update failed');
  } else {
    toast.success('Saved!');
    setAccount(data);
  }
}`}
            </pre>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">Search/Filter Pattern:</h4>
            <pre className="overflow-x-auto rounded bg-slate-950 p-3 text-xs text-green-400">
{`// Search by name
const { data } = await supabase
  .from('accounts')
  .select('*')
  .ilike('name', \`%\${searchTerm}%\`)  // Case-insensitive search
  .order('created_at', { ascending: false })
  .limit(10);`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Section 10: Quick Reference */}
      <Card className="border-purple-500">
        <CardHeader>
          <CardTitle>⚡ Quick Reference Cheat Sheet</CardTitle>
          <CardDescription>Copy-paste these commands</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-xs">
            <div className="rounded border p-2">
              <code className="font-mono">
                .select('*') - Get all columns
              </code>
            </div>
            <div className="rounded border p-2">
              <code className="font-mono">
                .select('id, name') - Get specific columns
              </code>
            </div>
            <div className="rounded border p-2">
              <code className="font-mono">
                .eq('column', value) - WHERE column = value
              </code>
            </div>
            <div className="rounded border p-2">
              <code className="font-mono">
                .neq('column', value) - WHERE column != value
              </code>
            </div>
            <div className="rounded border p-2">
              <code className="font-mono">
                .gt('column', value) - WHERE column {'>'} value
              </code>
            </div>
            <div className="rounded border p-2">
              <code className="font-mono">
                .lt('column', value) - WHERE column {'<'} value
              </code>
            </div>
            <div className="rounded border p-2">
              <code className="font-mono">
                .ilike('name', '%search%') - Case-insensitive LIKE
              </code>
            </div>
            <div className="rounded border p-2">
              <code className="font-mono">
                .order('created_at', {'{ ascending: false }'}) - Sort DESC
              </code>
            </div>
            <div className="rounded border p-2">
              <code className="font-mono">
                .limit(10) - Limit to 10 rows
              </code>
            </div>
            <div className="rounded border p-2">
              <code className="font-mono">
                .single() - Return object instead of array
              </code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Final Tips */}
      <Card className="border-green-500">
        <CardHeader>
          <CardTitle>💡 Pro Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
            <li>Always check for <code className="rounded bg-muted px-1">error</code> before using <code className="rounded bg-muted px-1">data</code></li>
            <li>Use <code className="rounded bg-muted px-1">.select()</code> after INSERT/UPDATE to get the modified data back</li>
            <li>Add <code className="rounded bg-muted px-1">.single()</code> when you know you want exactly one row</li>
            <li>Use TypeScript types from <code className="rounded bg-muted px-1">database.types.ts</code> for type safety</li>
            <li>Check browser console (F12) for detailed error messages</li>
            <li>Test queries in Supabase dashboard first before adding to code</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

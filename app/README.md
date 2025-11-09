Welcome to your new TanStack app! 

# Getting Started

To run this application:

```bash
pnpm install
pnpm start
```

# Building For Production

To build this application for production:

```bash
pnpm build
```

After building, you can start the production server:

```bash
pnpm start
```

## Docker Deployment

This application is configured with Docker and Docker Compose for deployment. The application uses **Neon serverless PostgreSQL** as the database (no local PostgreSQL container needed).

### Prerequisites

- Docker and Docker Compose installed on your system
- Neon database account and connection string

### Quick Start

1. **Create environment file** (if not already present):
   ```bash
   cp .env.example .env
   ```

2. **Set up Neon database**:
   - Sign up at [neon.tech](https://neon.tech)
   - Create a new project
   - Copy your connection string (it will look like: `postgresql://user:password@host.neon.tech/dbname?sslmode=require`)

3. **Update environment variables** in `.env` file:
   ```bash
   DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require
   ```

4. **Build and start the application**:
   ```bash
   docker-compose up -d --build
   ```

5. **View logs**:
   ```bash
   docker-compose logs -f
   ```

6. **Stop services**:
   ```bash
   docker-compose down
   ```

### Docker Commands

- **Build only the application image**:
  ```bash
  docker build -t tanstack-app .
  ```

- **Run database migrations**:
  ```bash
  pnpm db:push
  # or
  pnpm db:migrate
  ```

### Environment Variables

The following environment variables can be configured in your `.env` file:

- `DATABASE_URL` - **Required** - Neon PostgreSQL connection string (get from [neon.tech](https://neon.tech))
  - Format: `postgresql://user:password@host.neon.tech/dbname?sslmode=require`
- `APP_PORT` - Application port (default: 3000)
- `NODE_ENV` - Environment mode (development/production)
- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk authentication publishable key (for frontend)

### Production Considerations

For production deployments:

1. **Use environment variable management** for sensitive data (Fly.io secrets, etc.)
2. **Configure proper networking** and firewall rules
3. **Neon handles database backups automatically** - no manual backup setup needed
4. **Use a reverse proxy** (nginx, Traefik, etc.) in front of the application
5. **Enable SSL/TLS** for secure connections
6. **Neon connection strings include SSL** - ensure `sslmode=require` is in your connection string

The application uses Nitro v2 for server-side rendering and deployment flexibility. It's an abstraction layer over Vite/Tanstack Start.

## Database Setup

This application uses **Drizzle ORM** with **Neon serverless PostgreSQL** for a fully typesafe database experience.

### Neon Serverless PostgreSQL

Neon is a serverless PostgreSQL platform that offers:
- **Automatic scaling** - No need to manage database instances
- **Automatic backups** - Point-in-time recovery included
- **Branching** - Create database branches for testing (similar to Git)
- **Free tier** - 0.5GB storage, perfect for development
- **Low latency** - Global edge network

### Getting Started with Neon

1. **Sign up** at [neon.tech](https://neon.tech)
2. **Create a project** - Choose a region close to your deployment
3. **Copy your connection string** - It will look like:
   ```
   postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```
4. **Set it in your `.env` file**:
   ```bash
   DATABASE_URL=postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```

The application automatically configures Neon's serverless driver with WebSocket support for optimal performance.

### Features

- ✅ **Fully Typesafe** - TypeScript types are automatically inferred from your schema
- ✅ **Auto Migrations** - Database migrations run automatically on Docker container startup
- ✅ **Type Inference** - Get autocomplete and type checking for all database operations
- ✅ **Connection Pooling** - Optimized connection management with error handling

### Database Schema

Define your database schema in `src/db/schema.ts`:

```typescript
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const todos = pgTable("todos", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### Using the Database

**Three-layer architecture:**

1. **DB functions** (`src/db/*.ts`): Pure database operations
```typescript
// src/db/text.ts
export async function getTexts(): Promise<Text[]> {
  return await db.select().from(texts);
}
```

2. **Server functions** (`src/lib/*.ts`): RPC layer with validation
```typescript
// src/lib/text.ts
export const serverGetTexts = createServerFn({ method: 'GET' })
  .handler(async () => {
    const result = await getTexts();
    return { success: true, data: result };
  });
```

3. **Loaders/Components**: Use server functions (never DB directly)
```typescript
// Route loader
loader: async () => {
  const result = await serverGetTexts();
  return { texts: result.data };
}

// Component with TanStack Query
const { data } = useQuery({
  queryKey: ['texts'],
  queryFn: () => getTextsFn(),
  initialData: loaderData.texts,
});
```

**Key principle**: Loaders are isomorphic → always use server functions for DB access.

### Database Scripts

- `pnpm db:generate` - Generate migration files from schema changes
- `pnpm db:migrate` - Run migrations using drizzle-kit
- `pnpm db:migrate:run` - Run migrations using the migration script
- `pnpm db:push` - Push schema changes directly (dev only)
- `pnpm db:studio` - Open Drizzle Studio (database GUI)
- `pnpm db:wait` - Wait for PostgreSQL to be ready

### Docker Integration

When using Docker Compose with Neon:
1. **Connection** - App connects to Neon serverless PostgreSQL via the connection string
2. **Migrated** - Migrations run automatically on app container startup
3. **Ready** - Application starts after successful database connection

The migration process:
- Waits for Neon database to be accessible
- Runs all pending migrations
- Starts the application

**Note**: No local PostgreSQL container is needed - the app connects directly to Neon's cloud database.

### Type Safety

The database exports types for use throughout your application:

```typescript
import type { Database, Schema, Todo, NewTodo } from "@/db/types";

// Database instance type
const db: Database = ...;

// Schema type
const schema: Schema = ...;

// Inferred types from schema
const todo: Todo = { id: 1, title: "Test", createdAt: new Date() };
const newTodo: NewTodo = { title: "New todo" };
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.


## Linting & Formatting

This project uses [Biome](https://biomejs.dev/) for linting and formatting. The following scripts are available:


```bash
pnpm lint
pnpm format
pnpm check
```


## Setting up Clerk

- Set the `VITE_CLERK_PUBLISHABLE_KEY` in your `.env.local`.


## Shadcn

Add components using the latest version of [Shadcn](https://ui.shadcn.com/).

```bash
pnpx shadcn@latest add button
```

## Text Management Feature

CRUD operations example (`/admin/text`):
- **DB layer**: `getTexts()`, `insertText()`, `updateText()`, `deleteText()` in `src/db/text.ts`
- **Server layer**: `serverGetTexts`, `serverInsertText`, `serverUpdateText`, `serverDeleteText` in `src/lib/text.ts`
- **UI**: TanStack Form + Query with mutation invalidation
- **Pattern**: Loader → server function → DB function. Components use `useServerFn` + `useQuery`/`useMutation`

## Routing
This project uses [TanStack Router](https://tanstack.com/router). The initial setup is a file based router. Which means that the routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add another a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you use the `<Outlet />` component.

Here is an example layout that includes a header:

```tsx
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { Link } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => (
    <>
      <header>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
        </nav>
      </header>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
})
```

The `<TanStackRouterDevtools />` component is not required so you can remove it if you don't want it in your layout.

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).


## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
const peopleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/people",
  loader: async () => {
    const response = await fetch("https://swapi.dev/api/people");
    return response.json() as Promise<{
      results: {
        name: string;
      }[];
    }>;
  },
  component: () => {
    const data = peopleRoute.useLoaderData();
    return (
      <ul>
        {data.results.map((person) => (
          <li key={person.name}>{person.name}</li>
        ))}
      </ul>
    );
  },
});
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).

### React-Query

React-Query is an excellent addition or alternative to route loading and integrating it into you application is a breeze.

First add your dependencies:

```bash
pnpm add @tanstack/react-query @tanstack/react-query-devtools
```

Next we'll need to create a query client and provider. We recommend putting those in `main.tsx`.

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ...

const queryClient = new QueryClient();

// ...

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
```

You can also add TanStack Query Devtools to the root route (optional).

```tsx
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <ReactQueryDevtools buttonPosition="top-right" />
      <TanStackRouterDevtools />
    </>
  ),
});
```

Now you can use `useQuery` to fetch your data.

```tsx
import { useQuery } from "@tanstack/react-query";

import "./App.css";

function App() {
  const { data } = useQuery({
    queryKey: ["people"],
    queryFn: () =>
      fetch("https://swapi.dev/api/people")
        .then((res) => res.json())
        .then((data) => data.results as { name: string }[]),
    initialData: [],
  });

  return (
    <div>
      <ul>
        {data.map((person) => (
          <li key={person.name}>{person.name}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;
```

You can find out everything you need to know on how to use React-Query in the [React-Query documentation](https://tanstack.com/query/latest/docs/framework/react/overview).

## State Management

Another common requirement for React applications is state management. There are many options for state management in React. TanStack Store provides a great starting point for your project.

First you need to add TanStack Store as a dependency:

```bash
pnpm add @tanstack/store
```

Now let's create a simple counter in the `src/App.tsx` file as a demonstration.

```tsx
import { useStore } from "@tanstack/react-store";
import { Store } from "@tanstack/store";
import "./App.css";

const countStore = new Store(0);

function App() {
  const count = useStore(countStore);
  return (
    <div>
      <button onClick={() => countStore.setState((n) => n + 1)}>
        Increment - {count}
      </button>
    </div>
  );
}

export default App;
```

One of the many nice features of TanStack Store is the ability to derive state from other state. That derived state will update when the base state updates.

Let's check this out by doubling the count using derived state.

```tsx
import { useStore } from "@tanstack/react-store";
import { Store, Derived } from "@tanstack/store";
import "./App.css";

const countStore = new Store(0);

const doubledStore = new Derived({
  fn: () => countStore.state * 2,
  deps: [countStore],
});
doubledStore.mount();

function App() {
  const count = useStore(countStore);
  const doubledCount = useStore(doubledStore);

  return (
    <div>
      <button onClick={() => countStore.setState((n) => n + 1)}>
        Increment - {count}
      </button>
      <div>Doubled - {doubledCount}</div>
    </div>
  );
}

export default App;
```

We use the `Derived` class to create a new store that is derived from another store. The `Derived` class has a `mount` method that will start the derived store updating.

Once we've created the derived store we can use it in the `App` component just like we would any other store using the `useStore` hook.

You can find out everything you need to know on how to use TanStack Store in the [TanStack Store documentation](https://tanstack.com/store/latest).

# Demo files

Files prefixed with `demo` can be safely deleted. They are there to provide a starting point for you to play around with the features you've installed.

# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

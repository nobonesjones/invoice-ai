Model context protocol (MCP)

The Model Context Protocol (MCP) is a standard for connecting Large Language Models (LLMs) to external services. This guide will walk you through how to connect AI tools to Supabase using MCP.

There are a number of popular AI tools that support MCP, including:

Cursor
Claude desktop
Cline (VS Code extension)
Windsurf (Codium)
Connecting these tools to Supabase will allow you to query your database and perform other SQL operations using natural language commands.

Connect to Supabase using MCP#
We will use the Postgres MCP server to connect AI tools to Supabase.

Step 1: Find your database connection string#
To get started, you will need to retrieve your database connection string. These will differ depending on whether you are using a local or hosted instance of Supabase.

For a local Supabase instance#
When running a local instance of Supabase via the CLI, you can find your connection string by running:

supabase status

or if you are using npx:

npx supabase status

This will output a list of details about your local Supabase instance. Copy the DB URL field in the output.

For a hosted Supabase instance#
When running a hosted instance of Supabase, you can find your connection string by:

Navigating to your project's Connection settings
Copying the connection string found under Session pooler.
Step 2: Configure in your AI tool#
All MCP compatible tools can connect to Supabase using the Postgres MCP server. Pass the following CLI command to your tool:

npx -y @modelcontextprotocol/server-postgres <connection-string>

Replace <connection-string> with the connection string you retrieved in Step 1.

This assumes you have Node.js and npx installed. If you don't have Node.js or prefer to connect to the server using Docker, you can follow the instructions in the Postgres MCP server README.

Windows users
If you run Node.js and npx in WSL instead of directly on your Windows host, you'll need to prefix the command with wsl:

wsl npx -y @modelcontextprotocol/server-postgres <connection-string>

Below are some ways to connect to the Postgres MCP server using popular AI tools:

Cursor#
Open Cursor and open .cursor/mcp.json file. Create the file if it doesn't exist.

Add the following configuration:

{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "<connection-string>"]
    }
  }
}

Replace <connection-string> with your connection string.

Save the configuration file.

Open Cursor and navigate to Settings/MCP. You should see a green active status after the server is successfully connected.
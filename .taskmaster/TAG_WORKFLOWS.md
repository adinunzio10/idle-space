# Signal Garden Tag-Based Workflow Guide

## Overview
Task Master has been optimized with comprehensive tag organization system for efficient Signal Garden development. This guide provides workflow patterns for maximum productivity.

## Available Tag Contexts

### Feature-Based Contexts
- **`frontend`**: UI components, React Native views, styling, user interactions
- **`backend`**: Data management, save systems, resource calculations, game logic  
- **`galaxy-map`**: Rendering, zoom/pan mechanics, beacon visualization
- **`performance`**: Optimization, React Native fixes, rendering improvements

### Development Phase Contexts
- **`mvp`**: Core game loop functionality (Tasks 1-10) 
- **`ready`**: All dependencies complete, ready for immediate development

## Common Workflow Patterns

### 1. Feature-Focused Development
```bash
# Switch to specific feature context
task-master use-tag frontend

# Find next task for frontend work
task-master next

# List all pending frontend tasks
task-master list --status=pending --compact

# Switch back to master for full project view
task-master use-tag master
```

### 2. MVP Development Sprint
```bash
# Focus on core functionality
task-master use-tag mvp

# Get next MVP task
task-master next

# Check MVP progress
task-master list --with-subtasks
```

### 3. Performance Optimization Session
```bash
# Switch to performance context
task-master use-tag performance

# Find performance issues to address
task-master list --status=pending --compact

# Work on performance tasks
task-master next
```

### 4. Ready Task Selection
```bash
# Find tasks ready for immediate work
task-master use-tag ready

# Get next available task
task-master next

# Filter by specific criteria
task-master list --status=pending --compact
```

## Parallel Development Strategy

### Team Workflow
1. **Frontend Developer**: Use `frontend` and `mvp` contexts
2. **Backend Developer**: Use `backend` and `performance` contexts  
3. **Full-stack Developer**: Use `ready` context for highest priority items

### Context Switching Best Practices
- Always use `task-master use-tag master` for project overview
- Use specialized contexts for focused work sessions
- Switch contexts based on current development priorities
- Maintain awareness of cross-context dependencies

## Tag Management Commands

```bash
# View all available tags
task-master tags --show-metadata

# Create new specialized context
task-master add-tag <name> --copy-from=master -d="Description"

# Switch active context
task-master use-tag <name>

# Rename context if needed
task-master rename-tag <old> <new>

# Delete unused context
task-master delete-tag <name> --yes
```

## Integration with Claude Code

### Custom Slash Commands
Create `.claude/commands/task-focus.md` for quick context switching:
```markdown
Switch to focused development context: $ARGUMENTS

Steps:
1. Use `task-master use-tag $ARGUMENTS` to switch context
2. Run `task-master next` to find next available task
3. Show task details for implementation planning
```

### MCP Integration
All tag operations available through MCP tools:
- `use_tag` - Switch contexts
- `get_tasks` - List tasks with tag filtering  
- `next_task` - Get next task in current context

## Optimization Results

### Before Tag Implementation
- 57 tasks in single master context
- Manual task filtering required
- No focused development workflows
- Difficulty finding relevant tasks

### After Tag Implementation  
- 6 specialized contexts for targeted development
- Automatic filtering by development area
- Parallel development support
- Improved task discovery efficiency
- Maintained full project visibility through master context

## Recommended Usage Patterns

1. **Daily Standup**: Use `master` context for full project overview
2. **Feature Development**: Switch to appropriate feature context
3. **Bug Fixes**: Use `performance` context for optimization work
4. **Sprint Planning**: Use `mvp` context for core functionality focus
5. **Ready Tasks**: Use `ready` context when unsure what to work on next

This tag system provides focused workspaces while maintaining project coherence through the master context.
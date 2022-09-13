# Development

## Install on Fakezod

0. Clone or pull latest groups and urbit repos if you haven't
1. Boot a fake ship if you haven't making sure to use:
	`urbit -F zod`
2. Mount or create appropriate desks
	1. `|mount %garden`
	2. `|merge %groups our %base`
	3. `|mount %groups`
3. From the urbit repo:
	1. `rsync -avL --delete pkg/garden/* ~/urbit/zod/garden/` we delete here to clear the directory
	2. `rsync -avL --delete pkg/base-dev/* ~/urbit/zod/groups/` we delete here to clear the directory
	3. `rsync -avL pkg/garden-dev/* ~/urbit/zod/groups/`
4. From the groups repo:
	1. `rsync -avL desk/* ~/urbit/zod/groups/`
	2. `rsync -avL landscape-dev/* ~/urbit/zod/groups/`
5. Commit and install garden
	1. `|commit %garden`
	2. `|install our %garden`
6. Commit and install groups
	1. `|commit %groups`
	2. `|install our %groups`

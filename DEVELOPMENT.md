# Development

## Install on Fakezod

0. Clone or pull latest homestead and urbit repos if you haven't
1. Boot a fake ship if you haven't making sure to use:
	`urbit -F zod`
2. Mount or create appropriate desks
	1. `|mount %garden`
	2. `|merge %homestead our %base`
	3. `|mount %homestead`
3. From the urbit repo:
	1. `rsync -avL --delete pkg/garden/* ~/urbit/zod/garden/` we delete here to clear the directory
	2. `rsync -avL --delete pkg/base-dev/* ~/urbit/zod/homestead/` we delete here to clear the directory
	3. `rsync -avL pkg/garden-dev/* ~/urbit/zod/homestead/`
4. From the homestead repo:
	1. `rsync -avL desk/* ~/urbit/zod/homestead/`
	2. `rsync -avL landscape-dev/* ~/urbit/zod/homestead/`
5. Commit and install garden
	1. `|commit %garden`
	2. `|install our %garden`
6. Commit and install homestead
	1. `|commit %homestead`
	2. `|install our %homestead`

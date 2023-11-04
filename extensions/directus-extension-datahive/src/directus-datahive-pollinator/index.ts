import { defineModule } from '@directus/extensions-sdk';
import ModuleComponent from './src/module.vue';
import { runPollinator, testFC } from './src/pollinator/index'

export default defineModule({
	id: 'pollinator',
	name: 'Pollinator',
	icon: 'box',
	routes: [
		{
			path: 'pollinator',
			component: ModuleComponent,
		},
	],
	actions: {
		runPollinator,
		testFC
	},
});

export { runPollinator, testFC };
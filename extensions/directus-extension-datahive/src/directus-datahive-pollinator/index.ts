import { defineModule } from '@directus/extensions-sdk';
import ModuleComponent from './module.vue';
import { runPollinator, testFC } from './pollinator/src/index'

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
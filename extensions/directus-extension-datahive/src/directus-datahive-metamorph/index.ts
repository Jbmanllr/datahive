import { defineModule } from '@directus/extensions-sdk';
import ModuleComponent from './src/module.vue';

export default defineModule({
	id: 'custom',
	name: 'Custom',
	icon: 'box',
	routes: [
		{
			path: 'metamorph',
			component: ModuleComponent,
		},
	],
});

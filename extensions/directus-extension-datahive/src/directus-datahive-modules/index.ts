import { defineModule } from '@directus/extensions-sdk';
import ModuleComponent from './module.vue';

export default defineModule({
	id: 'datahive',
	name: 'Datahive',
	icon: 'box',
	routes: [
		{
			path: 'datahive',
			component: ModuleComponent,
		},
	],
});

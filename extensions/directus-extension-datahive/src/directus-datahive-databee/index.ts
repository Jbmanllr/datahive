import { defineModule } from '@directus/extensions-sdk';
import ModuleComponent from './src/module.vue';

export default defineModule({
	id: 'databee',
	name: 'Databee',
	icon: 'box',
	routes: [
		{
			path: 'databee',
			component: ModuleComponent,
		},
	],
});

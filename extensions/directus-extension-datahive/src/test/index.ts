import { defineModule } from '@directus/extensions-sdk';
import ModuleComponent from './module.vue';

export function testTEST() {
	console.log("TEST INSIDE")
}
export default defineModule({
	id: 'custom',
	name: 'Custom',
	icon: 'box',
	routes: [
		{
			path: '',
			component: ModuleComponent,
		},
	],
});

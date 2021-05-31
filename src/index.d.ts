declare module "color-parse" {
	type Color = {
		space: string;
		values: [number, number, number];
		alpha: number;
	}

	function color_parse(color: string): Color;

	export = color_parse;
}


function isObject<
	X extends {}
>(
	object: unknown
): object is X {
	return typeof object === "object" && object !== null;
}

function isArray(
	object: unknown
): object is unknown[] {
	return Array.isArray(object);
}

function hasProperty<
	X extends {}, 
	Y extends PropertyKey
>(
	object: X, 
	property: Y
): object is X & Record<Y, unknown> {
	return object.hasOwnProperty(property);
}

export {
	isObject,
	isArray,
	hasProperty,
};

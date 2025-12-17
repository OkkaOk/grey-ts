
if (globals.hasIndex("IS_GREYBEL")) {
	const oldUserInput: (...params: any[]) => string = userInput
	userInput = (message = "", isPassword = false, anyKey = false, _addToHistory = false) => oldUserInput(message, isPassword, anyKey)
}

print = (value: any, replaceText = false) => {
	return null;
}
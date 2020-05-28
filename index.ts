import { IConfig, ACTIONS } from './types.ts';
import Printer from './printer.ts';
import History from './history.ts';

export default class InputLoop {
	private buf = new Uint8Array(1024);
	done = false;
	out = new Printer();
	history = new History();

	constructor(args?: IConfig) {
		this.out = new Printer(args);
	}

	private coerceChoice = (value: string | number): string => {
		if (typeof value === 'number') {
			return String(value);
		}
		return value;
	}

	private promisify = (value?: string): Promise<string> => {
		return new Promise((resolve) => resolve(value));
	}

	/**
	 * Repeats the last prompt
	 * @param {string | number} value value to auto-select
	 */
	public repeat = (value?: string | number) => {
		if (this.history.retrieve().action) {
			if (this.history.retrieve().action === ACTIONS.CHOOSE) {
				return this.choose(this.history.retrieve().argument as string[], this.history.retrieve().lastOptionClose, value);
			}
			if (this.history.retrieve().action === ACTIONS.QUESTION) {
				return this.question(this.history.retrieve().argument as string, value);
			}
		}
	}

	/**
	 * Read input from the console
	 * @returns {Promise<string>} The value read
	 */
	public read = async (): Promise<string> => {
		return new Promise(async (resolve, reject) => {
			const n = await Deno.stdin.read(this.buf);

			if (n) {
				resolve(new TextDecoder().decode(this.buf.subarray(0, n)).replace('\n', ''));
			} else {
				reject();
			}
		});
	}

	/**
	 * Prompts the user to choose from a list of options
	 * @param {string[]} options
	 * @param {boolean} lastOptionClose Whether selecting the last option in the list should close the loop
	 * @param {string | number} choice value to auto-select
	 * @returns {Promise<boolean[]>} An array of booleans representing which index was selected
	 */
	public choose = async (options: string[], lastOptionClose?: boolean, choice?: string | number): Promise<boolean[]> => {
		this.out.newline();
		this.out.divider(30);
		options.forEach((option: string, index: number) => {
			this.out.print(`${index}: ${option}`);
		});
		this.out.divider(30);
		
		// Allow passing a result directly instead of prompting for it.
		// Mostly used for testing without the need for interactive input

		let result: string;
		if (choice !== undefined) {
			result = this.coerceChoice(choice);
		} else {
			result = await this.read();
		}

		this.history.save(options, ACTIONS.CHOOSE, lastOptionClose ?? false);

		if (lastOptionClose && result === String(options.length - 1)) {
			this.close();
		}

		return options.map((_option: string, index: number) => {
			if (result === String(index)) {
				return true;
			}
			return false;
		});
	}

	/**
	 * Prompts the user to answer a question
	 * @param {string} question
	 * @param {string | number} value value to auto-select
	 * @returns {Promise<string>} The value entered
	 */
	public question = (question: string, value?: string | number): Promise<string> => {
		this.out.print(question);

		this.history.save(question, ACTIONS.QUESTION);

		if (value) {
			return this.promisify(this.coerceChoice(value));
		}

		return this.read();
	}

	/**
	 * Closes the loop
	 */
	public close = () => {
		this.done = true;
	}
}
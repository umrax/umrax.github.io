import React from "react";
import data from "./data.csv";

const cmp = (left: string, right: string) => +(left > right) || -(left < right);

type columns = keyof data[number];
const columns: Record<columns, string> = {
	Index: "#",
	Japanese: "日文馬名",
	English: "英文馬名",
	Chinese: "中文馬名",
	Status: "譯名類別",
	Birth: "出生日期",
	Living: "目前狀態",
	Voice: "出演聲優",
	Source: "資料來源",
	Note: "備註",
};
const allColumns = Object.keys(columns) as columns[];

type status = data[number]["Status"];
const status: Record<status, string> = {
	Unnamed: "未命名：該馬匹未有已被命名的證據，此處顯示的名稱為網絡上的通稱或根據香港賽馬會馬匹命名規範構擬的馬名；",
	Temporary: "來源請求：該馬匹有線索顯示已被命名，但缺乏來源或來源可信度不足，需要加入來源；",
	Enquiry: "查詢：該名稱為向香港賽馬會進行查詢的回答；",
	Newspaper: "報紙：有資料顯示該馬匹已被命名，且該來源為指定報章之一；",
	Confirmed: "已確認：香港賽馬會網站有該馬匹的譯名。",
};
const allStatus = Object.keys(status) as status[];

const mapper: { [T in columns]: (item: data[number][T], state: State) => React.ReactNode } = {
	Index: item => item,
	Japanese: item => <span lang="ja">{item}</span>,
	English: item => <span lang="en">{item}</span>,
	Chinese: (item, state) => {
		if (!item) return;
		const [name, pronunciation] = item.split(";");
		return (
			<span lang="zh-Hant-HK" title={state.pronunciation ? undefined : pronunciation}>
				{state.pronunciation
					? pronunciation.split(" ").map((rt, i) => (
							<ruby key={`pronunciation-${i}`} lang="yue-Latn">
								{name[i]}
								<rp>（</rp>
								<rt>{rt}</rt>
								<rp>）</rp>
							</ruby>
					  ))
					: name}
			</span>
		);
	},
	Status: item => item[0],
	Birth: item => item.replace(/-0?/, "年").replace(/-0?/, "月") + "日",
	Living: item => ["", "健在", <b>現役</b>][item],
	Voice: (item, state) => {
		if (!item) return;
		const [name, pronunciation] = item.split(";");
		return (
			<span lang="ja" title={state.pronunciation ? undefined : pronunciation}>
				{state.pronunciation ? (
					<ruby>
						{name}
						<rp>（</rp>
						<rt>{pronunciation}</rt>
						<rp>）</rp>
					</ruby>
				) : (
					name
				)}
			</span>
		);
	},
	Source: item => {
		if (item) {
			const [text, link] = item.split(";");
			const [head, ...tail] = text.split("，");
			return (
				<>
					<a href={link} target="_blank">
						{head}
					</a>
					{(tail.length ? "，" : "") + tail.join("，")}
					{head.includes("來源不明") && (
						<>
							［
							<a href="https://github.com/umrax/umrax.github.io/issues" target="_blank">
								貢獻資料來源
							</a>
							］
						</>
					)}
				</>
			);
		}
		return (
			<>
				未有出處［
				<a href="https://github.com/umrax/umrax.github.io/issues" target="_blank">
					貢獻資料來源
				</a>
				］
			</>
		);
	},
	Note: item => item,
};
const sorter: { [T in columns]: (left: data[number][T], right: data[number][T], state: State) => number } = {
	Index: (left, right) => left - right,
	Japanese: cmp,
	English: cmp,
	Chinese: cmp,
	Status: (left, right) => allStatus.indexOf(left) - allStatus.indexOf(right),
	Birth: (left, right, state) => (state.year ? cmp(left, right) : cmp(left.slice(5), right.slice(5))),
	Living: (left, right) => left - right,
	Voice: (left, right) => cmp(left ? left.split(";")[1] : "", right ? right.split(";")[1] : ""),
	Source: (left, right) => cmp(left || "", right || ""),
	Note: (left, right) => cmp(left || "", right || ""),
};

const dummyDiv = document.createElement("div");

interface State {
	display: columns[];
	hidden: columns[];
	sort: columns;
	ascending: boolean;
	search: string;
	pronunciation: boolean;
	focus: columns | null;
	year: boolean;
}
const storeOptions: (keyof State)[] = ["display", "hidden", "sort", "ascending", "search", "pronunciation", "year"];
function defaultState(): State {
	return {
		display: ["Index", "Japanese", "English", "Chinese", "Status", "Source"],
		hidden: ["Birth", "Living", "Voice", "Note"],
		sort: "Index",
		ascending: true,
		search: "",
		pronunciation: false,
		focus: null,
		year: true,
	};
}

export default class Names extends React.Component<{}, State> {
	tableWrapperOuter = dummyDiv;
	tableWrapperInner = dummyDiv;
	tableOffset = dummyDiv;
	tableHeight = dummyDiv;

	constructor(props: {}) {
		super(props);
		const state = defaultState();
		storeOptions.forEach(option => option in localStorage && (state[option] = JSON.parse(localStorage[option]) as never));
		this.state = state;
	}

	setElement =
		<T extends keyof Names>(name: T) =>
		(element: Names[T] | null) => {
			if (element) this[name] = element;
		};

	componentDidUpdate() {
		storeOptions.forEach(option => (localStorage[option] = JSON.stringify(this.state[option])));
		this.onResize();
		this.onScroll();
	}

	moveUpwards = () => {
		this.setState(({ display, focus }) => {
			const index = display.indexOf(focus!);
			return index > 0
				? {
						display: [...display.slice(0, index - 1), display[index], display[index - 1], ...display.slice(index + 1)],
				  }
				: null;
		});
	};

	moveDownwards = () => {
		this.setState(({ display, focus }) => {
			const index = display.indexOf(focus!);
			return index > -1 && index < display.length - 1
				? {
						display: [...display.slice(0, index), display[index + 1], display[index], ...display.slice(index + 2)],
				  }
				: null;
		});
	};

	addItem = () => {
		this.setState(({ display, hidden, focus }) => {
			const index = hidden.indexOf(focus!);
			if (index > -1) {
				let newIndex = -1;
				display = [...display];
				hidden = [...hidden];
				const oldItem = hidden.splice(index, 1)[0];
				let currIndex = allColumns.indexOf(oldItem);
				while (newIndex === -1 && ++currIndex < allColumns.length) newIndex = display.indexOf(allColumns[currIndex]);
				if (newIndex === -1) newIndex = display.length;
				display.splice(newIndex, 0, oldItem);
				return { display, hidden };
			} else return null;
		});
	};

	removeItem = () => {
		this.setState(({ display, hidden, focus }) => {
			const index = display.indexOf(focus!);
			if (index > -1 && display.length > 1) {
				let newIndex = -1;
				display = [...display];
				hidden = [...hidden];
				const oldItem = display.splice(index, 1)[0];
				const currIndex = allColumns.indexOf(oldItem);
				newIndex = hidden.findIndex(item => allColumns.indexOf(item) > currIndex);
				if (newIndex === -1) newIndex = hidden.length;
				hidden.splice(newIndex, 0, oldItem);
				return { display, hidden };
			} else return null;
		});
	};

	changeSort = (column: columns) => () => {
		this.setState(({ sort, ascending }) => ({
			sort: column,
			ascending: sort !== column ? column !== "Birth" : !ascending,
		}));
	};

	changeYearSortMethod = (newYear: boolean) => () => {
		this.setState(({ ascending, year }) => ({
			year: newYear,
			ascending: ascending === (year === newYear),
		}));
	};

	onResize = () => {
		this.tableHeight.style.height = this.tableWrapperInner.scrollHeight - this.tableWrapperInner.clientHeight + "px";
	};

	onScroll = () => {
		this.tableWrapperInner.scrollTop = this.tableWrapperOuter.offsetTop - this.tableOffset.offsetTop;
	};

	componentDidMount() {
		this.onResize();
		this.onScroll();
		addEventListener("resize", this.onResize);
		addEventListener("resize", this.onScroll);
		addEventListener("scroll", this.onScroll);
	}

	componentWillUnmount() {
		removeEventListener("resize", this.onResize);
		removeEventListener("resize", this.onScroll);
		removeEventListener("scroll", this.onScroll);
	}

	render() {
		const { display, hidden, sort, ascending, search, pronunciation, year } = this.state;
		let filter = search
			.split("")
			.map(char => {
				const charCode = char.charCodeAt(0);
				if (charCode >= 0x3041 && charCode <= 0x3096) return String.fromCharCode(charCode + 0x60);
				if (charCode >= 0xfe01 && charCode <= 0xff5e) return String.fromCharCode(charCode - 0xfee0);
				return char;
			})
			.join("")
			.toLowerCase();
		if (/[\u3099-\u30ff]/.test(filter)) filter = filter.replace(/[^\u3099-\u30ff]+/g, "");
		return (
			<>
				<div>
					<div className="form-control my-3">
						<div className="flex">
							<div className="relative flex-1 mr-3">
								<label className="absolute top-0 left-0 rounded-r-none btn btn-primary text-4xl font-normal w-12 pointer-events-none">
									<span className="-rotate-45">⚲</span>
								</label>
								<input
									type="text"
									placeholder="搜尋馬名……"
									className="input input-primary input-bordered text-lg w-full pl-16"
									value={search}
									onChange={event => this.setState({ search: event.target.value })}
								></input>
							</div>
							<label htmlFor="edit-modal" className="btn btn-primary text-lg font-medium px-6">
								編輯欄位
							</label>
						</div>
					</div>
					<input type="checkbox" id="edit-modal" className="modal-toggle" onChange={() => this.setState({ focus: null })}></input>
					<div className="modal">
						<div className="modal-box p-10 sm:max-w-xl">
							<h4 className="font-semibold text-3xl text-center text-neutral">編輯欄位</h4>
							<div className="flex mt-6">
								<div className="flex-1">
									<div className="edit-columns">
										{hidden.map(key => (
											<div key={`edit-${key}`} onMouseDown={() => this.setState({ focus: key })} className={this.state.focus === key ? "focus" : ""}>
												{columns[key]}
											</div>
										))}
									</div>
								</div>
								<div className="flex-1 flex flex-col mx-3">
									<button onClick={this.moveUpwards}>向上移動 ↑</button>
									<button onClick={this.moveDownwards} className="mt-1">
										向下移動 ↓
									</button>
									<div className="flex-1"></div>
									<button onClick={this.addItem}>新增項目 →</button>
									<button onClick={this.removeItem} className="mt-1">
										← 移除項目
									</button>
									<div className="flex-1"></div>
								</div>
								<div className="flex-1">
									<div className="edit-columns">
										{display.map(key => (
											<div key={`edit-${key}`} onMouseDown={() => this.setState({ focus: key })} className={this.state.focus === key ? "focus" : ""}>
												{columns[key]}
											</div>
										))}
									</div>
								</div>
							</div>
							<div className="modal-action">
								<label className="cursor-pointer label">
									<input
										type="checkbox"
										className="toggle toggle-secondary"
										checked={pronunciation}
										onChange={event => this.setState({ pronunciation: event.target.checked })}
									></input>
									<span className="label-text text-xl ml-3">顯示發音</span>
								</label>
								<div className="flex-1"></div>
								<label className="btn btn-error text-lg px-8" onClick={() => this.setState(defaultState())}>
									重設
								</label>
								<label htmlFor="edit-modal" className="btn btn-primary text-lg px-8">
									關閉
								</label>
							</div>
						</div>
					</div>
				</div>
				<div ref={this.setElement("tableOffset")}></div>
				<div className="w-full overflow-hidden shadow-2xl rounded-lg sticky top-0" ref={this.setElement("tableWrapperOuter")}>
					<div className="w-full overflow-x-visible overflow-y-hidden max-h-screen" ref={this.setElement("tableWrapperInner")}>
						<table className="table table-zebra w-full">
							<thead className="bg-primary select-none cursor-pointer sticky top-0 z-50" title="按一下以變更排序方式">
								<tr>
									{display.map(key => (
										<th key={`0-${key}`} onClick={this.changeSort(key)}>
											<div>
												<span className="name">{columns[key]}</span>
												<span className={"sort" + (sort === key ? (ascending ? " asc" : " desc") : "")}></span>
											</div>
											{key === "Birth" && (
												<div className="sort-method">
													<div>
														<div>排序方式</div>
														<div className="mt-2 btn-group">
															<input
																type="radio"
																name="sort-method"
																className="btn btn-primary btn-outline btn-sm w-28"
																data-title="年月日"
																checked={year}
																onChange={this.changeYearSortMethod(true)}
															/>
															<input
																type="radio"
																name="sort-method"
																className="btn btn-primary btn-outline btn-sm w-28"
																data-title="僅月日"
																checked={!year}
																onChange={this.changeYearSortMethod(false)}
															/>
														</div>
													</div>
												</div>
											)}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{data
									.filter(row => row.Japanese.includes(filter) || row.English.toLowerCase().includes(filter) || row.Chinese.split(";")[0].includes(filter))
									.sort((left, right) => sorter[sort](left[sort] as never, right[sort] as never, this.state) * (+ascending || -1) || left.Index - right.Index)
									.map(row => (
										<tr key={row.Index}>
											{display.map(key => (
												<td key={`${row.Index}-${key}`} title={key === "Status" ? status[row[key]].slice(0, -1) : undefined}>
													{mapper[key](row[key] as never, this.state)}
												</td>
											))}
										</tr>
									))}
							</tbody>
						</table>
					</div>
				</div>
				<div ref={this.setElement("tableHeight")}></div>
			</>
		);
	}
}

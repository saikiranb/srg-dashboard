import * as XLSX from "xlsx";
import { rows } from "./data.mjs";
const data = rows.map(([n, Task, Category, Status, Priority, Description]) => ({ "S.No": n, Task, Description, Category, "Assigned To": "", Priority, Status, "Due Date": "" }));
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Tasks");
XLSX.writeFile(wb, "pending-works.xlsx");

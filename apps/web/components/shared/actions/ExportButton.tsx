"use client";

import {
  Button,
  Checkbox,
  CheckboxGroup,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Progress,
  useDisclosure,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useMemo, useState } from "react";

import { FeatureGatedButton } from "../billing/FeatureGate";

export type ExportFormat = "csv" | "pdf";

export interface ExportColumn {
  key: string;
  label: string;
  selected?: boolean;
}

export interface ExportOptions {
  format: ExportFormat;
  columns?: string[];
  dateRange?: { start: string; end: string };
  filters?: Record<string, unknown>;
}

export interface ExportButtonProps {
  data: Record<string, unknown>[] | (() => Promise<Record<string, unknown>[]>);
  columns?: ExportColumn[];
  filename?: string;
  formats?: ExportFormat[];
  onExport?: (options: ExportOptions) => Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  size?: "sm" | "md" | "lg";
  variant?:
    | "solid"
    | "bordered"
    | "light"
    | "flat"
    | "faded"
    | "shadow"
    | "ghost";
  color?:
    | "default"
    | "primary"
    | "secondary"
    | "success"
    | "warning"
    | "danger";
  className?: string;
  showColumnSelector?: boolean;
  maxRows?: number;
}

export function ExportButton({
  data,
  columns,
  filename = "export",
  formats = ["csv", "pdf"],
  onExport,
  disabled = false,
  loading = false,
  size = "md",
  variant: _variant = "flat",
  color = "primary",
  className,
  showColumnSelector = true,
  maxRows,
}: ExportButtonProps) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("csv");
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    columns?.filter((c) => c.selected !== false).map((c) => c.key) || [],
  );
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const formatIcons: Record<ExportFormat, string> = {
    csv: "solar:document-text-linear",
    pdf: "solar:document-linear",
  };

  const formatLabels = useMemo<Record<ExportFormat, string>>(
    () => ({
      csv: "CSV",
      pdf: "PDF",
    }),
    [],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: Export functions are defined below and don't need to be dependencies
  
  const downloadFile = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const exportToCSV = useCallback(async (
    data: Record<string, unknown>[],
    filename: string,
  ) => {
    if (data.length === 0) return;

    const firstRow = data[0] as Record<string, unknown>;
    const headers = Object.keys(firstRow);
    const csvContent = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header];

            // Escape commas and quotes in values
            if (
              typeof value === "string" &&
              (value.includes(",") || value.includes('"'))
            ) {
              return `"${value.replace(/"/g, '""')}"`;
            }

            return value ?? "";
          })
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

    downloadFile(blob, `${filename}.csv`);
  }, [downloadFile]);

  const exportToPDF = useCallback(async (
    data: Record<string, unknown>[],
    filename: string,
    columns?: ExportColumn[],
  ) => {
    // For PDF export, we'll create a simple HTML table and print it
    // For production, consider using a library like jsPDF
    const headers = columns?.map((c) => c.label) || Object.keys(data[0] || {});
    const keys = columns?.map((c) => c.key) || Object.keys(data[0] || {});

    const html = `
      <html>
        <head>
          <title>${filename}</title>
          <style>
            body { font-family: Arial, sans-serif; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
          </style>
        </head>
        <body>
          <h2>${filename}</h2>
          <table>
            <thead>
              <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${data
                .map(
                  (row) =>
                    `<tr>${keys.map((key) => `<td>${row[key] ?? ""}</td>`).join("")}</tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    window.open(url, "_blank");
    URL.revokeObjectURL(url);
  }, []);


  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setIsExporting(true);
      setExportProgress(0);

      try {
        const exportData = typeof data === "function" ? await data() : data;
        if (!exportData || exportData.length === 0) {
          addToast({ title: "No data to export", color: "danger" });
          return;
        }

        const limitedData = maxRows ? exportData.slice(0, maxRows) : exportData;

        const filteredData =
          showColumnSelector && selectedColumns.length > 0
            ? limitedData.map((row) => {
                const filtered: Record<string, unknown> = {};
                selectedColumns.forEach((key) => {
                  filtered[key] = row[key];
                });
                return filtered;
              })
            : limitedData;

        setExportProgress(30);

        if (onExport) {
          await onExport({ format, columns: selectedColumns, filters: {} });
          setExportProgress(100);
          addToast({ title: `Export completed successfully`, color: "default" });
          return;
        }

        switch (format) {
          case "csv":
            await exportToCSV(filteredData, filename);
            break;
          case "pdf":
            await exportToPDF(filteredData, filename, columns);
            break;
        }

        setExportProgress(100);
        addToast({
          title: `Exported ${limitedData.length} rows as ${formatLabels[format]}`,
          color: "default",
        });
      } catch (error) {
        console.error("Export error:", error);
        addToast({ title: "Failed to export data", color: "danger" });
      } finally {
        setIsExporting(false);
        setTimeout(() => setExportProgress(0), 500);
      }
    },
    [
      data,
      selectedColumns,
      showColumnSelector,
      maxRows,
      onExport,
      filename,
      columns,
      formatLabels,
      exportToCSV,
      exportToPDF,
    ],
  );
const handleQuickExport = (format: ExportFormat) => {
    if (showColumnSelector && columns && columns.length > 0) {
      setSelectedFormat(format);
      onOpen();
    } else {
      handleExport(format);
    }
  };

  if (formats.length === 1) {
    return (
      <>
        <FeatureGatedButton
          className={className}
          color="primary"
          disabled={disabled || isExporting}
          feature="export"
          isLoading={loading || isExporting}
          size={size}
          startContent={
            !isExporting && (
              <Icon className="w-4 h-4" icon="solar:export-bold-duotone" />
            )
          }
          onPress={() => handleQuickExport(formats[0] ?? "csv")}
        >
          Export {formatLabels[formats[0] ?? "csv"]}
        </FeatureGatedButton>

        {showColumnSelector && columns && (
          <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
            <ModalContent>
              {(onClose) => (
                <>
                  <ModalHeader>
                    Export as {formatLabels[selectedFormat]}
                  </ModalHeader>
                  <ModalBody>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-default-500 mb-3">
                          Select columns to export:
                        </p>
                        <CheckboxGroup
                          value={selectedColumns}
                          onValueChange={setSelectedColumns}
                        >
                          {columns.map((column) => (
                            <Checkbox key={column.key} value={column.key}>
                              {column.label}
                            </Checkbox>
                          ))}
                        </CheckboxGroup>
                      </div>
                      {maxRows && (
                        <p className="text-sm text-warning">
                          Note: Export is limited to {maxRows} rows
                        </p>
                      )}
                      {isExporting && (
                        <Progress
                          className="mt-4"
                          color="primary"
                          size="sm"
                          value={exportProgress}
                        />
                      )}
                    </div>
                  </ModalBody>
                  <ModalFooter>
                    <Button variant="light" onPress={onClose}>
                      Cancel
                    </Button>
                    <Button
                      color="primary"
                      disabled={selectedColumns.length === 0}
                      isLoading={isExporting}
                      onPress={() => {
                        handleExport(selectedFormat);
                        onClose();
                      }}
                    >
                      Export
                    </Button>
                  </ModalFooter>
                </>
              )}
            </ModalContent>
          </Modal>
        )}
      </>
    );
  }

  return (
    <>
      <Dropdown>
        <DropdownTrigger>
          <FeatureGatedButton
            className={className}
            color={color}
            disabled={disabled || isExporting}
            endContent={
              <Icon className="w-4 h-4" icon="solar:alt-arrow-down-linear" />
            }
            feature="export"
            isLoading={loading || isExporting}
            size={size}
            startContent={
              !isExporting && (
                <Icon className="w-4 h-4" icon="solar:export-bold-duotone" />
              )
            }
          >
            Export
          </FeatureGatedButton>
        </DropdownTrigger>
        <DropdownMenu
          aria-label="Export formats"
          onAction={(key) => handleQuickExport(key as ExportFormat)}
        >
          {formats.map((format) => (
            <DropdownItem
              key={format}
              startContent={
                <Icon className="w-4 h-4" icon={formatIcons[format]} />
              }
            >
              Export as {formatLabels[format]}
            </DropdownItem>
          ))}
        </DropdownMenu>
      </Dropdown>

      {showColumnSelector && columns && (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader>
                  Export as {formatLabels[selectedFormat]}
                </ModalHeader>
                <ModalBody>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-default-500 mb-3">
                        Select columns to export:
                      </p>
                      <CheckboxGroup
                        value={selectedColumns}
                        onValueChange={setSelectedColumns}
                      >
                        {columns.map((column) => (
                          <Checkbox key={column.key} value={column.key}>
                            {column.label}
                          </Checkbox>
                        ))}
                      </CheckboxGroup>
                    </div>
                    {maxRows && (
                      <p className="text-sm text-warning">
                        Note: Export is limited to {maxRows} rows
                      </p>
                    )}
                    {isExporting && (
                      <Progress
                        className="mt-4"
                        color="primary"
                        size="sm"
                        value={exportProgress}
                      />
                    )}
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button variant="light" onPress={onClose}>
                    Cancel
                  </Button>
                  <Button
                    color="primary"
                    disabled={selectedColumns.length === 0}
                    isLoading={isExporting}
                    onPress={() => {
                      handleExport(selectedFormat);
                      onClose();
                    }}
                  >
                    Export
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      )}
    </>
  );
}

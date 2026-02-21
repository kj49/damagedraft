export type RootStackParamList = {
  Home: undefined;
  ReportEditor: { reportId?: string } | undefined;
  IncompleteReports: undefined;
  CompletedReports: undefined;
  Options: undefined;
  DraftSuccess: { reportId: string };
};

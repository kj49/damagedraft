export type RootStackParamList = {
  Home: undefined;
  ReportEditor: { reportId?: string } | undefined;
  IncompleteReports: undefined;
  CompletedReports: undefined;
  VinDecoder: undefined;
  Options: undefined;
  DraftSuccess: { reportId: string };
};


from metafinder_core.queries import ReportFieldQueryParams


def test_report_field_query():
	query = ReportFieldQueryParams()
	results = query.query(10)
	
	assert len(results) == 972, f"Expected 972 results, but got {len(results)}"
	
	
def test_report_field_query_with_model_type():
	query = ReportFieldQueryParams(model_type="CreditCard")
	results = query.query(10)
	
	assert len(results) == 16, f"Expected 16 results, but got {len(results)}"
	for result in results:
		assert result.model_type == "CreditCard", f"Expected model_type to be 'CreditCard', but got {result.model_type}"
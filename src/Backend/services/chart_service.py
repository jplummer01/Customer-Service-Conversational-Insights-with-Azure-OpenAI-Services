import logging
from fastapi import HTTPException, status

from api.models.input_models import ChartFilters
from common.database.sqldb_service import adjust_processed_data_dates, fetch_chart_data, fetch_filters_data


class ChartService:
    """
    Service class for handling chart-related data retrieval.
    """

    def fetch_filter_data(self):
        """
        Fetch filter data for charts.
        """
        try:
            adjust_processed_data_dates()
            return fetch_filters_data()
        except Exception as e:
            logging.error("Error in fetch_filter_data: %s", e, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An error occurred while fetching filter data."
            )

    def fetch_chart_data(self):
        """
        Fetch chart data.
        """
        try:
            return fetch_chart_data()
        except Exception as e:
            logging.error("Error in fetch_chart_data: %s", e, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An error occurred while fetching chart data."
            )

    def fetch_chart_data_with_filters(self, chart_filters: ChartFilters):
        """
        Fetch chart data based on applied filters.
        """
        try:
            return fetch_chart_data(chart_filters)
        except Exception as e:
            logging.error("Error in fetch_chart_data_with_filters: %s", e, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An error occurred while fetching filtered chart data."
            )

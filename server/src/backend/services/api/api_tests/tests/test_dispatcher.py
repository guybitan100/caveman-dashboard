from unittest.mock import patch, MagicMock
import json

import pytest

from api.dispatcher import invoke_function, Dispatcher


@patch("api.dispatcher.lambda_client")
class TestInvokeFunction:
    def test_success(self, mock_lambda):
        payload_mock = MagicMock()
        payload_mock.read.return_value = b'{"result": "ok"}'
        mock_lambda.invoke.return_value = {
            "StatusCode": 200,
            "Payload": payload_mock,
        }
        result = invoke_function("my-func", {"key": "val"})
        assert result == b'{"result": "ok"}'
        mock_lambda.invoke.assert_called_once_with(
            FunctionName="my-func",
            Payload=json.dumps({"key": "val"}),
            LogType="None",
        )

    def test_non_200_raises(self, mock_lambda):
        payload_mock = MagicMock()
        payload_mock.read.return_value = b"error payload"
        mock_lambda.invoke.return_value = {
            "StatusCode": 500,
            "FunctionError": "Unhandled",
            "Payload": payload_mock,
        }
        with pytest.raises(Exception, match="returned status code 500"):
            invoke_function("my-func", {})

    def test_function_error_raises(self, mock_lambda):
        payload_mock = MagicMock()
        payload_mock.read.return_value = b"err"
        mock_lambda.invoke.return_value = {
            "StatusCode": 200,
            "FunctionError": "Handled",
            "Payload": payload_mock,
        }
        with pytest.raises(Exception, match="Handled"):
            invoke_function("my-func", {})

    def test_client_error_raises(self, mock_lambda):
        from botocore.exceptions import ClientError

        mock_lambda.invoke.side_effect = ClientError(
            {"Error": {"Code": "404", "Message": "Not Found"}}, "invoke"
        )
        with pytest.raises(ClientError):
            invoke_function("my-func", {})


@patch("api.dispatcher.SETTINGS", MagicMock(DEPLOYMENT="local"))
class TestDispatcherLocal:
    def test_run_generation_job_local(self):
        d = Dispatcher()
        result = d.run_generation_job("j1")
        assert result == "local"

    def test_stop_generation_job_local(self):
        d = Dispatcher()
        result = d.stop_generation_job("k8s-job-1")
        assert result is True


@patch("api.dispatcher.create_k8s_job", return_value="k8s-gen-j1")
@patch("api.dispatcher.SETTINGS", MagicMock(DEPLOYMENT="aws"))
class TestDispatcherAws:
    def test_run_generation_job_aws(self, mock_create):
        d = Dispatcher()
        result = d.run_generation_job("j1")
        assert result == "k8s-gen-j1"
        mock_create.assert_called_once_with("j1")

    @patch("api.dispatcher.delete_k8s_job", return_value=True)
    def test_stop_generation_job_aws(self, mock_delete, mock_create):
        d = Dispatcher()
        result = d.stop_generation_job("k8s-gen-j1")
        assert result is True
        mock_delete.assert_called_once_with("k8s-gen-j1")

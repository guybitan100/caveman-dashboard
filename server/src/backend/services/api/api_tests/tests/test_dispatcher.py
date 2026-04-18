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


class TestGetK8sClient:
    @patch(
        "api.dispatcher.SETTINGS",
        MagicMock(
            AWS_REGION="us-east-1",
            GENERATION_JOB_EKS_CLUSTER="my-cluster",
        ),
    )
    @patch("api.dispatcher.boto3.client")
    def test_returns_batch_api(self, mock_boto_client):
        mock_eks = MagicMock()
        mock_eks.describe_cluster.return_value = {
            "cluster": {
                "endpoint": "https://eks.example.com",
                "certificateAuthority": {"data": "dGVzdA=="},  # base64 "test"
            }
        }
        mock_sts = MagicMock()
        mock_sts.meta.service_model.service_id = "STS"
        mock_sts._request_signer._credentials = MagicMock()
        mock_sts._request_signer._event_emitter = MagicMock()

        mock_boto_client.side_effect = lambda service, **kw: {
            "eks": mock_eks,
            "sts": mock_sts,
        }[service]

        with patch("api.dispatcher.RequestSigner") as mock_signer_cls:
            mock_signer = MagicMock()
            mock_signer.generate_presigned_url.return_value = "https://signed-url"
            mock_signer_cls.return_value = mock_signer

            with patch("api.dispatcher.tempfile.NamedTemporaryFile") as mock_tmp:
                mock_file = MagicMock()
                mock_file.name = "/tmp/test.pem"
                mock_tmp.return_value = mock_file

                # Mock kubernetes module since it's not installed locally
                mock_k8s = MagicMock()
                with patch.dict(
                    "sys.modules",
                    {"kubernetes": MagicMock(), "kubernetes.client": mock_k8s},
                ):
                    from api.dispatcher import _get_k8s_client

                    batch_api, k8s = _get_k8s_client()
                    assert batch_api is not None


class TestCreateK8sJob:
    @patch("api.dispatcher._get_k8s_client")
    @patch(
        "api.dispatcher.SETTINGS",
        MagicMock(
            GENERATION_JOB_EKS_NAMESPACE="titan",
            GENERATION_JOB_EKS_IMAGE="img:latest",
            GENERATION_JOB_EKS_SERVICE_ACCOUNT="sa",
        ),
    )
    def test_creates_job(self, mock_get_k8s):
        mock_batch = MagicMock()
        mock_k8s = MagicMock()
        mock_get_k8s.return_value = (mock_batch, mock_k8s)
        from api.dispatcher import create_k8s_job

        result = create_k8s_job(job_id="abcdefgh-1234")
        assert result.startswith("gen-abcdefgh")
        mock_batch.create_namespaced_job.assert_called_once()

    @patch("api.dispatcher._get_k8s_client")
    @patch(
        "api.dispatcher.SETTINGS",
        MagicMock(
            GENERATION_JOB_EKS_NAMESPACE=None,
            GENERATION_JOB_EKS_IMAGE="img:latest",
            GENERATION_JOB_EKS_SERVICE_ACCOUNT=None,
        ),
    )
    def test_create_raises(self, mock_get_k8s):
        mock_batch = MagicMock()
        mock_batch.create_namespaced_job.side_effect = RuntimeError("k8s fail")
        mock_k8s = MagicMock()
        mock_get_k8s.return_value = (mock_batch, mock_k8s)
        from api.dispatcher import create_k8s_job

        with pytest.raises(RuntimeError):
            create_k8s_job(job_id="abcdefgh-1234")


class TestDeleteK8sJob:
    @patch("api.dispatcher._get_k8s_client")
    @patch("api.dispatcher.SETTINGS", MagicMock(GENERATION_JOB_EKS_NAMESPACE="titan"))
    def test_delete_success(self, mock_get_k8s):
        mock_batch = MagicMock()
        mock_k8s = MagicMock()
        mock_get_k8s.return_value = (mock_batch, mock_k8s)
        from api.dispatcher import delete_k8s_job

        result = delete_k8s_job("gen-abc-123")
        assert result is True

    @patch("api.dispatcher._get_k8s_client")
    @patch("api.dispatcher.SETTINGS", MagicMock(GENERATION_JOB_EKS_NAMESPACE=None))
    def test_delete_failure(self, mock_get_k8s):
        mock_batch = MagicMock()
        mock_batch.delete_namespaced_job.side_effect = RuntimeError("k8s fail")
        mock_k8s = MagicMock()
        mock_get_k8s.return_value = (mock_batch, mock_k8s)
        from api.dispatcher import delete_k8s_job

        result = delete_k8s_job("gen-abc-123")
        assert result is False

from datetime import datetime
from enum import Enum
from typing import Iterator

from faker import Faker

from model.types import FinancialAccount, EventType
from model.tasks import FinancialAccountTask
from generation.simulation.events.contractors.contractor import EventContractor
from generation.simulation.events.contractors.registry import register_contractor
from generation.simulation.utils import random_times
from model.utils import str_uuid

_faker = Faker()


class FinancialAccountType(Enum):
    BANK_ACCOUNT = 'BankAccount'
    CRYPTOCURRENCY_WALLET = 'CryptocurrencyWallet'
    ELECTRONIC_WALLET = 'ElectronicWallet'
    UNKNOWN = 'Unknown'


FINANCIAL_ACCOUNT_TYPE_WEIGHTS = (0.5, 0.2, 0.2, 0.1)


class Currencies(Enum):
    Unknown = 'Unknown'
    UnitedStatesDollar = 'UnitedStatesDollar'
    Euro = 'Euro'
    JapaneseYen = 'JapaneseYen'
    PoundSterling = 'PoundSterling'
    AustralianDollar = 'AustralianDollar'
    CanadianDollar = 'CanadianDollar'
    SwissFranc = 'SwissFranc'
    Renminbi = 'Renminbi'
    HongKongDollar = 'HongKongDollar'
    NewZealandDollar = 'NewZealandDollar'
    SwedishKrona = 'SwedishKrona'
    SouthKoreanWon = 'SouthKoreanWon'
    SingaporeDollar = 'SingaporeDollar'
    NorwegianKrone = 'NorwegianKrone'
    MexicanPeso = 'MexicanPeso'
    IndianRupee = 'IndianRupee'
    RussianRuble = 'RussianRuble'
    SouthAfricanRand = 'SouthAfricanRand'
    TurkishLira = 'TurkishLira'
    BrazilianReal = 'BrazilianReal'
    NewTaiwanDollar = 'NewTaiwanDollar'
    DanishKrone = 'DanishKrone'
    PolishZloty = 'PolishZloty'
    ThaiBaht = 'ThaiBaht'
    IndonesianRupiah = 'IndonesianRupiah'
    HungarianForint = 'HungarianForint'
    CzechKoruna = 'CzechKoruna'
    IsraeliNewShekel = 'IsraeliNewShekel'
    ChileanPeso = 'ChileanPeso'
    PhilippinePeso = 'PhilippinePeso'
    UaeDirham = 'UaeDirham'
    ColombianPeso = 'ColombianPeso'
    SaudiRiyal = 'SaudiRiyal'
    MalaysianRinggit = 'MalaysianRinggit'
    RomanianLeu = 'RomanianLeu'
    Bitcoin = 'Bitcoin'
    BitcoinCash = 'BitcoinCash'
    Litecoin = 'Litecoin'
    Ethereum = 'Ethereum'
    MobileCoin = 'MobileCoin'


@register_contractor(EventType.FINANCIAL_ACCOUNT)
class FinancialAccountContractor(EventContractor[FinancialAccountTask, FinancialAccount]):
    def construct(self) -> Iterator[FinancialAccount]:
        # Todo: generate id by account type?
        account_ids = (str_uuid() for _ in range(self.quantity))
        account_types = self._random_enum_choices(self.quantity, FinancialAccountType,
                                                  weights=FINANCIAL_ACCOUNT_TYPE_WEIGHTS)
        asset_totals = self._random_range_choices(
            self.quantity, self.task.min_account_assets, self.task.max_account_assets)
        times = random_times(n=self.quantity, job=self.job)
        location_ids = self.hub.get_task_location_ids(task=self.task)

        accounts = (
            self._construct_bank_account(
                timestamp=time,
                account_id=account_id,
                account_type=account_type,
                num_assets=num_assets,
                location_id=location_id
            )
            for time, account_id, account_type, num_assets, location_id
            in zip(times, account_ids, account_types, asset_totals, location_ids)
        )

        yield from accounts

    def _construct_bank_account(
            self,
            timestamp: datetime,
            account_id: str,
            account_type: FinancialAccountType,
            num_assets: int,
            location_id: str | None
    ) -> FinancialAccount:
        assets = self._random_enum_choices(num_assets, Currencies)
        return FinancialAccount(
            account_id=account_id,
            account_type=account_type.value,
            assets=list(asset.value for asset in assets),
            time=timestamp,
            location_id=location_id
        )
